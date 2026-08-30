import type { EntityManager } from '@mikro-orm/postgresql'
import {
  CONTINUE_PAGE_MIDDLEWARE,
  type PageRouteMiddleware,
} from '@open-mercato/shared/modules/middleware/page'
import { McaWorkspaceSettings } from '../data/entities'
import { resolveOnboardingRedirect } from '../lib/onboarding/gate'
import { parseOnboardingState } from '../lib/onboarding/state'

const ONBOARDING_GATE_TARGET = /^\/backend(?:\/merchant_advances(?:\/onboarding)?)?\/?$/

type RbacService = {
  userHasAllFeatures: (
    userId: string,
    features: string[],
    scope: { tenantId: string; organizationId: string },
  ) => Promise<boolean>
}

export async function resolveMerchantAdvancesOnboardingGate(input: {
  pathname: string
  userId: string | null
  tenantId: string | null
  organizationId: string | null
  ensureContainer: () => Promise<{ resolve: (name: string) => unknown }>
}): Promise<{ action: 'continue' } | { action: 'redirect'; location: string }> {
  if (!input.userId || !input.tenantId || !input.organizationId) return CONTINUE_PAGE_MIDDLEWARE
  try {
    const container = await input.ensureContainer()
    const rbac = container.resolve('rbacService') as RbacService
    const scope = { tenantId: input.tenantId, organizationId: input.organizationId }
    const [canManage, canReport] = await Promise.all([
      rbac.userHasAllFeatures(input.userId, ['merchant_advances.settings.manage'], scope),
      rbac.userHasAllFeatures(input.userId, ['merchant_advances.reports.view'], scope),
    ])
    const granted = [
      ...(canManage ? ['merchant_advances.settings.manage'] : []),
      ...(canReport ? ['merchant_advances.reports.view'] : []),
    ]
    const em = (container.resolve('em') as EntityManager).fork()
    const settings = await em.findOne(McaWorkspaceSettings, {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      deletedAt: null,
    })
    const completedAt = parseOnboardingState(settings?.onboarding ?? null).completedAt
    return resolveOnboardingRedirect({
      pathname: input.pathname,
      grantedFeatures: granted,
      completedAt,
    })
  } catch {
    return CONTINUE_PAGE_MIDDLEWARE
  }
}

export const middleware: PageRouteMiddleware[] = [
  {
    id: 'merchant_advances.backend.onboarding-gate',
    mode: 'backend',
    target: ONBOARDING_GATE_TARGET,
    priority: 20,
    async run(context) {
      return resolveMerchantAdvancesOnboardingGate({
        pathname: context.pathname,
        userId: context.auth?.sub ?? null,
        tenantId: context.auth?.tenantId ?? null,
        organizationId: context.auth?.orgId ?? null,
        ensureContainer: context.ensureContainer,
      })
    },
  },
]

export default middleware
