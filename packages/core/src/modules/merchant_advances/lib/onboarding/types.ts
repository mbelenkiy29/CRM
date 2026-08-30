export const MCA_ONBOARDING_STEPS = [
  'welcome',
  'shop',
  'intake',
  'people',
  'funders',
  'documents',
  'extras',
  'first_deal',
] as const

export type McaOnboardingStep = (typeof MCA_ONBOARDING_STEPS)[number]

export const MCA_ONBOARDING_INTAKE_SOURCES = [
  'jotform',
  'gohighlevel',
  'zoho',
  'custom',
  'spreadsheet',
  'unsure',
] as const

export type McaOnboardingIntakeSource = (typeof MCA_ONBOARDING_INTAKE_SOURCES)[number]

export const MCA_ONBOARDING_ASSIGNMENTS = ['form_owner', 'round_robin'] as const
export type McaOnboardingAssignment = (typeof MCA_ONBOARDING_ASSIGNMENTS)[number]

export const MCA_ONBOARDING_FUNDER_ROUTES = ['email', 'portal', 'webhook', 'api_deferred'] as const
export type McaOnboardingFunderRoute = (typeof MCA_ONBOARDING_FUNDER_ROUTES)[number]

export const MCA_ONBOARDING_PLAN = 'supercharged'
export const MCA_ONBOARDING_TRIAL_DAYS = 15

export const SUNSET_DINER_FIXTURE = {
  businessName: 'Sunset Diner',
  industry: 'Auto repair',
  state: 'TX',
  avgMonthlyRevenue: '142000',
  timeInBusinessMonths: 36,
  position: 1,
  requestedAmount: '75000',
} as const

export type McaOnboardingShop = {
  legalName: string | null
  dbaName: string | null
  primaryState: string | null
  timezone: string | null
  defaultCurrency: string
  brokerLogoAttachmentId: string | null
  defaultFromAddress: string | null
}

export type McaOnboardingSeat = {
  userId: string
  email: string | null
  name: string | null
  floor: 'admin' | 'rep'
  fromAddress: string | null
}

export type McaOnboardingIntake = {
  source: McaOnboardingIntakeSource | null
  assignment: McaOnboardingAssignment
  assigneeUserIds: string[]
  secretIssued: boolean
  testedDealId: string | null
}

export type McaOnboardingSender = {
  userId: string
  fromAddress: string
}

export type McaOnboardingExtras = {
  sms: {
    enabled: boolean
    providerName: string | null
    configured: boolean
    status: 'configured_not_sending'
  }
  esign: {
    enabled: boolean
    provider: 'docuseal' | 'hellosign' | 'other' | null
    configured: boolean
    status: 'configured_not_sending'
  }
  outboundWebhooks: {
    offerCreated: string | null
    replyParsed: string | null
    submissionFailed: string | null
    renewalSurfaced: string | null
  }
}

export type McaOnboardingDocuments = {
  stampDestinationFunder: boolean
  watermarkEnabled: boolean
  uploadLinksEnabled: boolean
  uploadLinkTtlHours: number
}

export type McaOnboardingFirstDeal = {
  dealExists: boolean
  rescored: boolean
  selectedFunderIds: string[]
  submitted: boolean
  sampleReplyPosted: boolean
  skippedWithWarning: boolean
}

export type McaOnboardingState = {
  step: McaOnboardingStep
  completedAt: string | null
  skipped: McaOnboardingStep[]
  shop: McaOnboardingShop
  seats: McaOnboardingSeat[]
  intake: McaOnboardingIntake
  fundersImported: boolean
  senders: McaOnboardingSender[]
  extras: McaOnboardingExtras
  documents: McaOnboardingDocuments
  firstDeal: McaOnboardingFirstDeal
  firstDealId: string | null
  defaultOriginatorUserId: string | null
  plan: string
  trialEndsAt: string | null
}

export type McaOnboardingStatusChips = {
  intakeConnected: boolean
  funderCount: number
  senderCount: number
  extrasOn: boolean
  completed: boolean
}

export const EMPTY_ONBOARDING_SHOP: McaOnboardingShop = {
  legalName: null,
  dbaName: null,
  primaryState: null,
  timezone: null,
  defaultCurrency: 'USD',
  brokerLogoAttachmentId: null,
  defaultFromAddress: null,
}

export const EMPTY_ONBOARDING_INTAKE: McaOnboardingIntake = {
  source: null,
  assignment: 'form_owner',
  assigneeUserIds: [],
  secretIssued: false,
  testedDealId: null,
}

export const EMPTY_ONBOARDING_EXTRAS: McaOnboardingExtras = {
  sms: { enabled: false, providerName: null, configured: false, status: 'configured_not_sending' },
  esign: { enabled: false, provider: null, configured: false, status: 'configured_not_sending' },
  outboundWebhooks: {
    offerCreated: null,
    replyParsed: null,
    submissionFailed: null,
    renewalSurfaced: null,
  },
}

export const EMPTY_ONBOARDING_DOCUMENTS: McaOnboardingDocuments = {
  stampDestinationFunder: true,
  watermarkEnabled: true,
  uploadLinksEnabled: true,
  uploadLinkTtlHours: 72,
}

export const EMPTY_ONBOARDING_FIRST_DEAL: McaOnboardingFirstDeal = {
  dealExists: false,
  rescored: false,
  selectedFunderIds: [],
  submitted: false,
  sampleReplyPosted: false,
  skippedWithWarning: false,
}
