import { onboardingSaveSchema } from '../../../data/validators'
import { shouldLaunchGettingStarted, GETTING_STARTED_STEPS, gettingStartedStepByIndex } from '../gettingStarted'

describe('shouldLaunchGettingStarted', () => {
  it('does not launch before onboarding is complete', () => {
    expect(shouldLaunchGettingStarted({
      onboardingCompletedAt: null,
      tour: { dismissedAt: null, completedAt: null, currentStep: 0 },
      queryTour: 'getting-started',
    })).toBe(false)
  })

  it('launches once after onboarding when the tour is untouched', () => {
    expect(shouldLaunchGettingStarted({
      onboardingCompletedAt: '2026-08-31T12:00:00.000Z',
      tour: { dismissedAt: null, completedAt: null, currentStep: 0 },
      queryTour: null,
    })).toBe(true)
  })

  it('does not auto-launch after dismiss or complete', () => {
    expect(shouldLaunchGettingStarted({
      onboardingCompletedAt: '2026-08-31T12:00:00.000Z',
      tour: { dismissedAt: '2026-08-31T13:00:00.000Z', completedAt: null, currentStep: 0 },
      queryTour: null,
    })).toBe(false)
    expect(shouldLaunchGettingStarted({
      onboardingCompletedAt: '2026-08-31T12:00:00.000Z',
      tour: { dismissedAt: null, completedAt: '2026-08-31T13:00:00.000Z', currentStep: 5 },
      queryTour: null,
    })).toBe(false)
  })

  it('relaunches when the query param is present', () => {
    expect(shouldLaunchGettingStarted({
      onboardingCompletedAt: '2026-08-31T12:00:00.000Z',
      tour: { dismissedAt: '2026-08-31T13:00:00.000Z', completedAt: '2026-08-31T13:00:00.000Z', currentStep: 5 },
      queryTour: 'getting-started',
    })).toBe(true)
  })
})

it('accepts a gettingStarted patch on onboardingSaveSchema', () => {
  const parsed = onboardingSaveSchema.parse({
    organizationId: '018f1a2b-3c4d-4000-8000-000000000001',
    tenantId: '018f1a2b-3c4d-4000-8000-000000000002',
    gettingStarted: { dismissedAt: '2026-08-31T13:00:00.000Z', currentStep: 1 },
  })
  expect(parsed.gettingStarted?.dismissedAt).toBe('2026-08-31T13:00:00.000Z')
  expect(parsed.gettingStarted?.currentStep).toBe(1)
})

describe('GETTING_STARTED_STEPS', () => {
  it('starts with a dialog step then five anchored steps', () => {
    expect(GETTING_STARTED_STEPS[0]).toMatchObject({ id: 'welcome', kind: 'dialog' })
    expect(GETTING_STARTED_STEPS.map((step) => step.id)).toEqual([
      'welcome',
      'deals-new',
      'pipeline-board',
      'match-submit',
      'funders-table',
      'setup-replay',
    ])
    expect(gettingStartedStepByIndex(0).route).toBe('/backend/merchant_advances')
    expect(gettingStartedStepByIndex(2).route).toBe('/backend/merchant_advances/pipeline')
  })
})
