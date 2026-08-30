import { NextResponse } from 'next/server'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { MCA_ONBOARDING_RESOURCE_KIND } from '../../../commands/onboarding'
import { resolveMerchantAdvancesRouteContext } from '../../routeContext'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.settings.manage'] },
}

export async function POST(req: Request): Promise<Response> {
  try {
    const context = await resolveMerchantAdvancesRouteContext(req)
    const guarded = await runRouteMutationGuards({
      container: context.ctx.container,
      req,
      auth: { userId: context.ctx.auth?.sub ?? '', tenantId: context.tenantId, organizationId: context.organizationId },
      input: {
        resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
        resourceId: 'intake-secret',
        operation: 'update',
        mutationPayload: { rotate: true },
      },
    })
    if (!guarded.ok) return guarded.response
    const commandBus = context.ctx.container.resolve('commandBus') as CommandBus
    const input = withScopedPayload({}, context.ctx, context.translate)
    const { result } = await commandBus.execute<{ organizationId: string; tenantId: string }, { secret: string }>(
      'merchant_advances.onboarding.rotate_secret',
      { input, ctx: context.ctx },
    )
    await guarded.runAfterSuccess()
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('merchant_advances.errors.onboardingSaveFailed', 'Failed to save MCA onboarding.') },
      { status: 500 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Generate or rotate the x-mca-intake-secret',
  methods: {
    POST: {
      summary: 'Generate or rotate the x-mca-intake-secret',
      responses: [{ status: 200, description: 'Secret shown once.' }],
    },
  },
}
