import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { onboardingSaveSchema, type OnboardingSaveInput } from '../../data/validators'
import { McaFunder, McaWorkspaceSettings } from '../../data/entities'
import {
  loadIntakeWebhookSecret,
  loadIntakeWorkspaceConfig,
} from '../../commands/settings'
import {
  MCA_ONBOARDING_RESOURCE_KIND,
  loadWorkspaceSettings,
  settingsOnboardingState,
  type OnboardingSaveResult,
} from '../../commands/onboarding'
import { onboardingStatusChips } from '../../lib/onboarding/state'
import { canAdministerOnboarding } from '../../lib/onboarding/gate'
import { isWebhooksModuleEnabled } from '../../lib/intake/webhooksEnabled'
import { buildIntakeSamplePayload } from '../../lib/onboarding/fixture'
import { toRecord } from '../../lib/crudScope'
import { resolveMerchantAdvancesRouteContext } from '../routeContext'

const logger = createLogger('merchant_advances').child({ route: 'onboarding' })

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.settings.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['merchant_advances.settings.manage'] },
}

export async function GET(req: Request): Promise<Response> {
  try {
    const context = await resolveMerchantAdvancesRouteContext(req)
    const settings = await loadWorkspaceSettings(context.em, {
      tenantId: context.tenantId,
      organizationId: context.organizationId,
    })
    const state = settingsOnboardingState(settings)
    const funderCount = await context.em.count(McaFunder, {
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      deletedAt: null,
    })
    const secret = await loadIntakeWebhookSecret(context.ctx.container, {
      tenantId: context.tenantId,
      organizationId: context.organizationId,
    })
    const config = await loadIntakeWorkspaceConfig(context.ctx.container, {
      tenantId: context.tenantId,
      organizationId: context.organizationId,
    })
    return NextResponse.json({
      ok: true,
      result: {
        onboarding: {
          ...state,
          documents: {
            ...state.documents,
            uploadLinksEnabled: config.uploadLinksEnabled,
            uploadLinkTtlHours: config.uploadLinkTtlHours,
            watermarkEnabled: settings.watermarkEnabled,
          },
          shop: {
            ...state.shop,
            defaultFromAddress: settings.defaultFromAddress ?? state.shop.defaultFromAddress,
            brokerLogoAttachmentId: settings.brokerLogoAttachmentId ?? state.shop.brokerLogoAttachmentId,
          },
        },
        plan: settings.plan ?? state.plan,
        trialEndsAt: settings.trialEndsAt?.toISOString() ?? state.trialEndsAt,
        intakeWebhookSecretConfigured: Boolean(secret),
        intakeSecret: null,
        webhooksEnabled: isWebhooksModuleEnabled(),
        webhookUrl: `/api/merchant_advances/intake/form?organizationId=${context.organizationId}&tenantId=${context.tenantId}`,
        samplePayload: buildIntakeSamplePayload({
          organizationId: context.organizationId,
          tenantId: context.tenantId,
        }),
        chips: onboardingStatusChips({ state, funderCount }),
        canAdminister: canAdministerOnboarding(['merchant_advances.settings.manage']),
        updatedAt: settings.updatedAt.toISOString(),
      },
    })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    const { translate } = await resolveTranslations()
    logger.error('MCA onboarding load failed', { err })
    return NextResponse.json(
      { error: translate('merchant_advances.errors.onboardingLoadFailed', 'Failed to load MCA onboarding.') },
      { status: 500 },
    )
  }
}

export async function PUT(req: Request): Promise<Response> {
  try {
    const context = await resolveMerchantAdvancesRouteContext(req)
    const parsed = onboardingSaveSchema.omit({ organizationId: true, tenantId: true }).parse(toRecord(await readJsonSafe(req, {})))
    const existing = await context.em.findOne(McaWorkspaceSettings, {
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      deletedAt: null,
    })
    const guarded = await runRouteMutationGuards({
      container: context.ctx.container,
      req,
      auth: {
        userId: context.ctx.auth?.sub ?? '',
        tenantId: context.tenantId,
        organizationId: context.organizationId,
      },
      input: {
        resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
        resourceId: existing?.id ?? null,
        operation: existing ? 'update' : 'create',
        mutationPayload: { ...parsed },
      },
    })
    if (!guarded.ok) return guarded.response
    const commandInput = onboardingSaveSchema.parse(
      withScopedPayload({ ...parsed, ...guarded.modifiedPayload }, context.ctx, context.translate),
    )
    const commandBus = context.ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<OnboardingSaveInput, OnboardingSaveResult>(
      'merchant_advances.onboarding.save',
      { input: commandInput, ctx: context.ctx },
    )
    await guarded.runAfterSuccess()
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      const { translate } = await resolveTranslations()
      return NextResponse.json(
        { error: translate('merchant_advances.errors.invalidOnboarding', 'Onboarding payload is invalid.') },
        { status: 400 },
      )
    }
    const { translate } = await resolveTranslations()
    logger.error('MCA onboarding save failed', { err })
    return NextResponse.json(
      { error: translate('merchant_advances.errors.onboardingSaveFailed', 'Failed to save MCA onboarding.') },
      { status: 500 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  GET: {
    path: '/merchant_advances/onboarding',
    summary: 'Load MCA shop onboarding wizard state',
    tags: ['Merchant Advances'],
    responses: {
      200: { description: 'Onboarding state.' },
    },
  },
  PUT: {
    path: '/merchant_advances/onboarding',
    summary: 'Save MCA shop onboarding wizard state',
    tags: ['Merchant Advances'],
    request: { body: { content: { 'application/json': { schema: onboardingSaveSchema.omit({ organizationId: true, tenantId: true }) } } } },
    responses: {
      200: { description: 'Onboarding saved.' },
    },
  },
}
