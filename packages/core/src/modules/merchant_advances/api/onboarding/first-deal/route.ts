import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { onboardingActionSchema } from '../../../data/validators'
import { MCA_ONBOARDING_RESOURCE_KIND } from '../../../commands/onboarding'
import { firstDealWouldSubmit, parseFirstDealAction } from '../../../lib/onboarding/firstDeal'
import { toRecord } from '../../../lib/crudScope'
import { resolveMerchantAdvancesRouteContext } from '../../routeContext'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.settings.manage'] },
}

export async function POST(req: Request): Promise<Response> {
  try {
    const context = await resolveMerchantAdvancesRouteContext(req)
    const parsed = onboardingActionSchema.omit({ organizationId: true, tenantId: true }).parse(toRecord(await readJsonSafe(req, {})))
    const action = parseFirstDealAction(parsed)
    const guarded = await runRouteMutationGuards({
      container: context.ctx.container,
      req,
      auth: { userId: context.ctx.auth?.sub ?? '', tenantId: context.tenantId, organizationId: context.organizationId },
      input: {
        resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
        resourceId: 'first-deal',
        operation: action === 'ensure' ? 'create' : 'update',
        mutationPayload: { ...parsed, action },
      },
    })
    if (!guarded.ok) return guarded.response
    const commandBus = context.ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<
      Record<string, unknown>,
      { dealId: string; action: string; submitted: boolean; matchCount: number | null; matches: Array<{ funderId: string; score: string | null }> }
    >(
      'merchant_advances.onboarding.first_deal',
      {
        input: withScopedPayload({ ...parsed, action, ...guarded.modifiedPayload }, context.ctx, context.translate),
        ctx: context.ctx,
      },
    )
    await guarded.runAfterSuccess()
    return NextResponse.json({
      ok: true,
      result: {
        ...result,
        autoSubmit: false,
        submitted: firstDealWouldSubmit(action),
      },
    })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      const { translate } = await resolveTranslations()
      return NextResponse.json({ error: translate('merchant_advances.errors.invalidOnboarding', 'Onboarding payload is invalid.') }, { status: 400 })
    }
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('merchant_advances.errors.onboardingSaveFailed', 'Failed to save MCA onboarding.') }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Create or reuse Sunset Diner and run the first-deal checklist. Never auto-submits funders.',
  methods: {
    POST: {
      summary: 'Create or reuse Sunset Diner and run the first-deal checklist. Never auto-submits funders.',
      responses: [{ status: 200, description: 'First-deal checklist updated.' }],
    },
  },
}
