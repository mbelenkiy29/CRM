import type { McaGettingStartedState } from './types'

export type GettingStartedStepKind = 'dialog' | 'anchor'

export type GettingStartedStep = {
  id: 'welcome' | 'deals-new' | 'pipeline-board' | 'match-submit' | 'funders-table' | 'setup-replay'
  kind: GettingStartedStepKind
  route: string
  anchorId: string | null
  titleKey: string
  bodyKey: string
}

export const GETTING_STARTED_STEPS: readonly GettingStartedStep[] = [
  {
    id: 'welcome',
    kind: 'dialog',
    route: '/backend/merchant_advances',
    anchorId: null,
    titleKey: 'merchant_advances.tour.welcome.title',
    bodyKey: 'merchant_advances.tour.welcome.body',
  },
  {
    id: 'deals-new',
    kind: 'anchor',
    route: '/backend/merchant_advances',
    anchorId: 'deals-new',
    titleKey: 'merchant_advances.tour.deals.title',
    bodyKey: 'merchant_advances.tour.deals.body',
  },
  {
    id: 'pipeline-board',
    kind: 'anchor',
    route: '/backend/merchant_advances/pipeline',
    anchorId: 'pipeline-board',
    titleKey: 'merchant_advances.tour.pipeline.title',
    bodyKey: 'merchant_advances.tour.pipeline.body',
  },
  {
    id: 'match-submit',
    kind: 'anchor',
    route: '/backend/merchant_advances',
    anchorId: 'match-submit',
    titleKey: 'merchant_advances.tour.match.title',
    bodyKey: 'merchant_advances.tour.match.body',
  },
  {
    id: 'funders-table',
    kind: 'anchor',
    route: '/backend/merchant_advances/funders',
    anchorId: 'funders-table',
    titleKey: 'merchant_advances.tour.funders.title',
    bodyKey: 'merchant_advances.tour.funders.body',
  },
  {
    id: 'setup-replay',
    kind: 'anchor',
    route: '/backend/merchant_advances/settings',
    anchorId: 'setup-replay',
    titleKey: 'merchant_advances.tour.setup.title',
    bodyKey: 'merchant_advances.tour.setup.body',
  },
] as const

export function gettingStartedStepByIndex(index: number): GettingStartedStep {
  const clamped = Math.max(0, Math.min(GETTING_STARTED_STEPS.length - 1, index))
  return GETTING_STARTED_STEPS[clamped]
}

export function shouldLaunchGettingStarted(input: {
  onboardingCompletedAt: string | null
  tour: McaGettingStartedState
  queryTour: string | null
}): boolean {
  if (!input.onboardingCompletedAt) return false
  if (input.queryTour === 'getting-started') return true
  if (input.tour.completedAt || input.tour.dismissedAt) return false
  return true
}
