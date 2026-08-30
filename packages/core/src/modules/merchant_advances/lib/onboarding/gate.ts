import { hasFeature } from '@open-mercato/shared/security/features'

export const MCA_ONBOARDING_PATH = '/backend/merchant_advances/onboarding'
export const MCA_DEALS_PATH = '/backend/merchant_advances'
export const MCA_ADMIN_FEATURE = 'merchant_advances.settings.manage'
export const MCA_REPORTS_FEATURE = 'merchant_advances.reports.view'

const LANDING_PATHS = new Set([
  '/backend',
  '/backend/',
  '/backend/merchant_advances',
  '/backend/merchant_advances/',
])

export function canAdministerOnboarding(granted: readonly string[] | null | undefined): boolean {
  return hasFeature(granted, MCA_ADMIN_FEATURE) || hasFeature(granted, MCA_REPORTS_FEATURE)
}

export function isOnboardingPath(pathname: string): boolean {
  return pathname === MCA_ONBOARDING_PATH || pathname === `${MCA_ONBOARDING_PATH}/`
}

export function isAdminLandingPath(pathname: string): boolean {
  return LANDING_PATHS.has(pathname)
}

export function resolveOnboardingRedirect(input: {
  pathname: string
  grantedFeatures: readonly string[] | null | undefined
  completedAt: string | null
}): { action: 'continue' } | { action: 'redirect'; location: string } {
  const admin = canAdministerOnboarding(input.grantedFeatures)
  if (isOnboardingPath(input.pathname)) {
    if (!admin) return { action: 'redirect', location: MCA_DEALS_PATH }
    return { action: 'continue' }
  }
  if (admin && !input.completedAt && isAdminLandingPath(input.pathname)) {
    return { action: 'redirect', location: MCA_ONBOARDING_PATH }
  }
  return { action: 'continue' }
}

export function shouldShowSetupBanner(input: {
  grantedFeatures: readonly string[] | null | undefined
  completedAt: string | null
}): boolean {
  return !input.completedAt && !canAdministerOnboarding(input.grantedFeatures)
}
