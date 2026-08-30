import { resolveOnboardingRedirect } from '../../lib/onboarding/gate'

describe('merchant_advances backend onboarding middleware', () => {
  it('redirects managers away from the wizard path', () => {
    expect(resolveOnboardingRedirect({
      pathname: '/backend/merchant_advances/onboarding',
      grantedFeatures: ['merchant_advances.deal.view'],
      completedAt: null,
    })).toEqual({ action: 'redirect', location: '/backend/merchant_advances' })
  })

  it('sends incomplete admins from the deals landing to the wizard', () => {
    expect(resolveOnboardingRedirect({
      pathname: '/backend/merchant_advances',
      grantedFeatures: ['merchant_advances.settings.manage'],
      completedAt: null,
    })).toEqual({ action: 'redirect', location: '/backend/merchant_advances/onboarding' })
  })

  it('stops the landing gate after completedAt is written', () => {
    expect(resolveOnboardingRedirect({
      pathname: '/backend/merchant_advances',
      grantedFeatures: ['merchant_advances.settings.manage'],
      completedAt: '2026-08-30T12:00:00.000Z',
    })).toEqual({ action: 'continue' })
  })
})
