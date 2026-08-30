import { NextResponse } from 'next/server'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { MCA_ONBOARDING_RESOURCE_KIND } from '../../../commands/onboarding'
import { isWebhooksModuleEnabled } from '../../../lib/intake/webhooksEnabled'
import { resolveMerchantAdvancesRouteContext } from '../../routeContext'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.settings.manage'] },
}

export async function POST(req: Request): Promise<Response> {
  const { translate } = await resolveTranslations()
  if (!isWebhooksModuleEnabled()) {
    return NextResponse.json(
      { error: translate('merchant_advances.errors.webhooksDisabled', 'Form intake is unavailable because webhooks are disabled.') },
      { status: 404 },
    )
  }
  try {
    const context = await resolveMerchantAdvancesRouteContext(req)
    const guarded = await runRouteMutationGuards({
      container: context.ctx.container,
      req,
      auth: { userId: context.ctx.auth?.sub ?? '', tenantId: context.tenantId, organizationId: context.organizationId },
      input: {
        resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
        resourceId: 'test-intake',
        operation: 'create',
        mutationPayload: { fixture: 'sunset-diner' },
      },
    })
    if (!guarded.ok) return guarded.response
    const commandBus = context.ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute(
      'merchant_advances.onboarding.test_intake',
      { input: withScopedPayload({}, context.ctx, context.translate), ctx: context.ctx },
    )
    await guarded.runAfterSuccess()
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json(
      { error: translate('merchant_advances.errors.intakeFailed', 'Failed to create the MCA application.') },
      { status: 500 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  POST: {
    path: '/merchant_advances/onboarding/test-intake',
    summary: 'Create the Sunset Diner intake fixture without fetching statement URLs',
    tags: ['Merchant Advances'],
    responses: {
      200: { description: 'Fixture deal created.' },
      404: { description: 'Webhooks module is disabled.' },
    },
  },
}
