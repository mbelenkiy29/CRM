import { NextResponse } from 'next/server'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { loadWorkspaceSettings, settingsOnboardingState } from '../../../commands/onboarding'
import { canAdministerOnboarding, shouldShowSetupBanner } from '../../../lib/onboarding/gate'
import { shouldLaunchGettingStarted } from '../../../lib/onboarding/gettingStarted'
import { resolveMerchantAdvancesRouteContext } from '../../routeContext'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.deal.view'] },
}

export async function GET(req: Request): Promise<Response> {
  try {
    const context = await resolveMerchantAdvancesRouteContext(req)
    const settings = await loadWorkspaceSettings(context.em, {
      tenantId: context.tenantId,
      organizationId: context.organizationId,
    })
    const state = settingsOnboardingState(settings)
    const rbac = context.ctx.container.resolve('rbacService') as {
      userHasAllFeatures: (
        userId: string,
        features: string[],
        scope: { tenantId: string; organizationId: string },
      ) => Promise<boolean>
    }
    const userId = context.ctx.auth?.sub
    const canAdminister = userId
      ? await rbac.userHasAllFeatures(userId, ['merchant_advances.settings.manage'], {
        tenantId: context.tenantId,
        organizationId: context.organizationId,
      })
      : false
    const granted = canAdminister ? ['merchant_advances.settings.manage'] : ['merchant_advances.deal.view']
    return NextResponse.json({
      ok: true,
      result: {
        completedAt: state.completedAt,
        step: state.step,
        canAdminister,
        showSetupBanner: shouldShowSetupBanner({ grantedFeatures: granted, completedAt: state.completedAt }),
        gettingStarted: {
          dismissedAt: state.gettingStarted.dismissedAt,
          completedAt: state.gettingStarted.completedAt,
          currentStep: state.gettingStarted.currentStep,
          shouldLaunch: shouldLaunchGettingStarted({
            onboardingCompletedAt: state.completedAt,
            tour: state.gettingStarted,
            queryTour: null,
          }),
        },
      },
    })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('merchant_advances.errors.onboardingLoadFailed', 'Failed to load MCA onboarding.') },
      { status: 500 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'MCA onboarding gate status for the current workspace',
  methods: {
    GET: {
      summary: 'MCA onboarding gate status for the current workspace',
      responses: [{ status: 200, description: 'Onboarding gate flags.' }],
    },
  },
}
