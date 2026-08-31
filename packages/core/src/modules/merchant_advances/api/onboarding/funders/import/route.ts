import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { funderCsvImportSchema } from '../../../../data/validators'
import { MCA_ONBOARDING_RESOURCE_KIND } from '../../../../commands/onboarding'
import { toRecord } from '../../../../lib/crudScope'
import { resolveMerchantAdvancesRouteContext } from '../../../routeContext'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.funder.manage'] },
}

export async function POST(req: Request): Promise<Response> {
  try {
    const context = await resolveMerchantAdvancesRouteContext(req)
    const parsed = funderCsvImportSchema.omit({ organizationId: true, tenantId: true }).parse(toRecord(await readJsonSafe(req, {})))
    const guarded = await runRouteMutationGuards({
      container: context.ctx.container,
      req,
      auth: { userId: context.ctx.auth?.sub ?? '', tenantId: context.tenantId, organizationId: context.organizationId },
      input: {
        resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
        resourceId: 'funder-import',
        operation: parsed.commit ? 'create' : 'update',
        mutationPayload: { ...parsed },
      },
    })
    if (!guarded.ok) return guarded.response
    const commandBus = context.ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute(
      'merchant_advances.onboarding.import_funders',
      {
        input: withScopedPayload({ ...parsed, ...guarded.modifiedPayload }, context.ctx, context.translate),
        ctx: context.ctx,
      },
    )
    await guarded.runAfterSuccess()
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      const { translate } = await resolveTranslations()
      return NextResponse.json({ error: translate('merchant_advances.errors.invalidPayload', 'Invalid payload') }, { status: 400 })
    }
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('merchant_advances.errors.saveFailed', 'Could not save') }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Preview or commit a funder roster CSV. SSN-shaped cells are rejected.',
  methods: {
    POST: {
      summary: 'Preview or commit a funder roster CSV. SSN-shaped cells are rejected.',
      responses: [{ status: 200, description: 'Preview or created funders.' }],
    },
  },
}
