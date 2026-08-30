import {
  completeOnboarding,
  createEmptyOnboardingState,
  isOnboardingComplete,
  mergeOnboardingState,
  parseOnboardingState,
  peopleStepComplete,
  resumeOnboardingStep,
  shopProfileComplete,
} from '../state'
import { resolveOnboardingRedirect, shouldShowSetupBanner } from '../gate'

const ADMIN_FEATURES = ['merchant_advances.*']
const MANAGER_FEATURES = ['merchant_advances.deal.view', 'merchant_advances.deal.manage']

function shopReady() {
  return {
    legalName: 'Harbor ISO LLC',
    dbaName: 'Harbor ISO',
    primaryState: 'TX',
    timezone: 'America/Chicago',
    defaultCurrency: 'USD',
    brokerLogoAttachmentId: null,
    defaultFromAddress: 'iso@harbor.example',
  }
}

describe('merchant_advances onboarding state', () => {
  it('resumes at the last saved step after reload', () => {
    const saved = mergeOnboardingState(createEmptyOnboardingState(), {
      step: 'intake',
      shop: shopReady(),
      intake: {
        source: 'jotform',
        assignment: 'form_owner',
        assigneeUserIds: [],
        secretIssued: true,
        testedDealId: null,
      },
    })
    const reloaded = parseOnboardingState(JSON.parse(JSON.stringify(saved)))
    expect(resumeOnboardingStep(reloaded)).toBe('intake')
    expect(reloaded.intake.source).toBe('jotform')
  })

  it('requires shop + people + intake or first deal before completion', () => {
    const empty = createEmptyOnboardingState()
    expect(isOnboardingComplete(empty)).toBe(false)
    const shopOnly = mergeOnboardingState(empty, { shop: shopReady() })
    expect(shopProfileComplete(shopOnly.shop)).toBe(true)
    expect(isOnboardingComplete(shopOnly)).toBe(false)
    const withPeople = mergeOnboardingState(shopOnly, {
      seats: [{ userId: '018f1a2b-3c4d-4000-8000-000000000001', email: 'admin@shop.example', name: 'Admin', floor: 'admin', fromAddress: 'rep@shop.example' }],
      senders: [{ userId: '018f1a2b-3c4d-4000-8000-000000000001', fromAddress: 'rep@shop.example' }],
    })
    expect(peopleStepComplete(withPeople)).toBe(true)
    expect(isOnboardingComplete(withPeople)).toBe(false)
    const withDeal = mergeOnboardingState(withPeople, { firstDealId: '018f1a2b-3c4d-4000-8000-000000000099', firstDeal: { dealExists: true } })
    expect(isOnboardingComplete(withDeal)).toBe(true)
    const completed = completeOnboarding(withDeal, new Date('2026-08-30T12:00:00.000Z'))
    expect(completed.completedAt).toBe('2026-08-30T12:00:00.000Z')
  })

  it('defaults plan and trial without collecting a card', () => {
    const state = createEmptyOnboardingState(new Date('2026-08-30T00:00:00.000Z'))
    expect(state.plan).toBe('supercharged')
    expect(state.trialEndsAt).toBe('2026-09-14T00:00:00.000Z')
  })
})

describe('merchant_advances onboarding gate', () => {
  it('redirects managers and reps away from the wizard', () => {
    expect(resolveOnboardingRedirect({
      pathname: '/backend/merchant_advances/onboarding',
      grantedFeatures: MANAGER_FEATURES,
      completedAt: null,
    })).toEqual({ action: 'redirect', location: '/backend/merchant_advances' })
  })

  it('sends an admin with incomplete setup from the landing page to the wizard', () => {
    expect(resolveOnboardingRedirect({
      pathname: '/backend/merchant_advances',
      grantedFeatures: ADMIN_FEATURES,
      completedAt: null,
    })).toEqual({ action: 'redirect', location: '/backend/merchant_advances/onboarding' })
  })

  it('stops redirecting after completedAt is written', () => {
    expect(resolveOnboardingRedirect({
      pathname: '/backend/merchant_advances',
      grantedFeatures: ADMIN_FEATURES,
      completedAt: '2026-08-30T12:00:00.000Z',
    })).toEqual({ action: 'continue' })
  })

  it('shows the ask-an-admin banner to managers when setup is unfinished', () => {
    expect(shouldShowSetupBanner({ grantedFeatures: MANAGER_FEATURES, completedAt: null })).toBe(true)
    expect(shouldShowSetupBanner({ grantedFeatures: ADMIN_FEATURES, completedAt: null })).toBe(false)
    expect(shouldShowSetupBanner({ grantedFeatures: MANAGER_FEATURES, completedAt: '2026-08-30T12:00:00.000Z' })).toBe(false)
  })
})
