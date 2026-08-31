import { MCA_DEFAULT_UPLOAD_TTL_HOURS, resolveUploadTtlHours } from '../intake/uploadLinks'
import {
  EMPTY_GETTING_STARTED,
  EMPTY_ONBOARDING_DOCUMENTS,
  EMPTY_ONBOARDING_EXTRAS,
  EMPTY_ONBOARDING_FIRST_DEAL,
  EMPTY_ONBOARDING_INTAKE,
  EMPTY_ONBOARDING_SHOP,
  MCA_ONBOARDING_ASSIGNMENTS,
  MCA_ONBOARDING_INTAKE_SOURCES,
  MCA_ONBOARDING_PLAN,
  MCA_ONBOARDING_STEPS,
  MCA_ONBOARDING_TRIAL_DAYS,
  type McaGettingStartedState,
  type McaOnboardingAssignment,
  type McaOnboardingDocuments,
  type McaOnboardingExtras,
  type McaOnboardingFirstDeal,
  type McaOnboardingIntake,
  type McaOnboardingIntakeSource,
  type McaOnboardingSeat,
  type McaOnboardingSender,
  type McaOnboardingShop,
  type McaOnboardingState,
  type McaOnboardingStatusChips,
  type McaOnboardingStep,
} from './types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asText(value: unknown, max = 300): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function asUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asStep(value: unknown): McaOnboardingStep {
  return typeof value === 'string' && (MCA_ONBOARDING_STEPS as readonly string[]).includes(value)
    ? value as McaOnboardingStep
    : 'welcome'
}

function asIntakeSource(value: unknown): McaOnboardingIntakeSource | null {
  return typeof value === 'string' && (MCA_ONBOARDING_INTAKE_SOURCES as readonly string[]).includes(value)
    ? value as McaOnboardingIntakeSource
    : null
}

function asAssignment(value: unknown): McaOnboardingAssignment {
  return typeof value === 'string' && (MCA_ONBOARDING_ASSIGNMENTS as readonly string[]).includes(value)
    ? value as McaOnboardingAssignment
    : 'form_owner'
}

function asEmail(value: unknown): string | null {
  const text = asText(value, 320)
  return text && EMAIL_RE.test(text) ? text : null
}

export function defaultTrialEndsAt(now = new Date()): string {
  return new Date(now.getTime() + MCA_ONBOARDING_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export function createEmptyOnboardingState(now = new Date()): McaOnboardingState {
  return {
    step: 'welcome',
    completedAt: null,
    skipped: [],
    shop: { ...EMPTY_ONBOARDING_SHOP },
    seats: [],
    intake: { ...EMPTY_ONBOARDING_INTAKE, assigneeUserIds: [] },
    fundersImported: false,
    senders: [],
    extras: structuredClone(EMPTY_ONBOARDING_EXTRAS),
    documents: { ...EMPTY_ONBOARDING_DOCUMENTS, uploadLinkTtlHours: MCA_DEFAULT_UPLOAD_TTL_HOURS },
    firstDeal: { ...EMPTY_ONBOARDING_FIRST_DEAL, selectedFunderIds: [] },
    firstDealId: null,
    defaultOriginatorUserId: null,
    plan: MCA_ONBOARDING_PLAN,
    trialEndsAt: defaultTrialEndsAt(now),
    gettingStarted: { ...EMPTY_GETTING_STARTED },
  }
}

function parseShop(value: unknown, fallback: McaOnboardingShop): McaOnboardingShop {
  if (!isRecord(value)) return { ...fallback }
  return {
    legalName: asText(value.legalName) ?? fallback.legalName,
    dbaName: asText(value.dbaName) ?? fallback.dbaName,
    primaryState: asText(value.primaryState, 8)?.toUpperCase() ?? fallback.primaryState,
    timezone: asText(value.timezone, 80) ?? fallback.timezone,
    defaultCurrency: asText(value.defaultCurrency, 8)?.toUpperCase() ?? fallback.defaultCurrency,
    brokerLogoAttachmentId: asUuid(value.brokerLogoAttachmentId) ?? fallback.brokerLogoAttachmentId,
    defaultFromAddress: asEmail(value.defaultFromAddress) ?? fallback.defaultFromAddress,
  }
}

function parseSeats(value: unknown): McaOnboardingSeat[] {
  if (!Array.isArray(value)) return []
  const seats: McaOnboardingSeat[] = []
  for (const row of value) {
    if (!isRecord(row)) continue
    const userId = asUuid(row.userId)
    if (!userId) continue
    seats.push({
      userId,
      email: asEmail(row.email),
      name: asText(row.name, 200),
      floor: row.floor === 'admin' ? 'admin' : 'rep',
      fromAddress: asEmail(row.fromAddress),
    })
  }
  return seats
}

function parseIntake(value: unknown, fallback: McaOnboardingIntake): McaOnboardingIntake {
  if (!isRecord(value)) return { ...fallback, assigneeUserIds: [...fallback.assigneeUserIds] }
  const assigneeUserIds = Array.isArray(value.assigneeUserIds)
    ? value.assigneeUserIds.map(asUuid).filter((id): id is string => Boolean(id))
    : fallback.assigneeUserIds
  return {
    source: asIntakeSource(value.source) ?? fallback.source,
    assignment: asAssignment(value.assignment),
    assigneeUserIds,
    secretIssued: asBoolean(value.secretIssued, fallback.secretIssued),
    testedDealId: asUuid(value.testedDealId) ?? fallback.testedDealId,
  }
}

function parseSenders(value: unknown): McaOnboardingSender[] {
  if (!Array.isArray(value)) return []
  const senders: McaOnboardingSender[] = []
  for (const row of value) {
    if (!isRecord(row)) continue
    const userId = asUuid(row.userId)
    const fromAddress = asEmail(row.fromAddress)
    if (!userId || !fromAddress) continue
    senders.push({ userId, fromAddress })
  }
  return senders
}

function parseExtras(value: unknown, fallback: McaOnboardingExtras): McaOnboardingExtras {
  if (!isRecord(value)) return structuredClone(fallback)
  const sms = isRecord(value.sms) ? value.sms : {}
  const esign = isRecord(value.esign) ? value.esign : {}
  const hooks = isRecord(value.outboundWebhooks) ? value.outboundWebhooks : {}
  const provider = asText(esign.provider, 40)
  return {
    sms: {
      enabled: asBoolean(sms.enabled, fallback.sms.enabled),
      providerName: asText(sms.providerName, 120),
      configured: asBoolean(sms.configured, fallback.sms.configured),
      status: 'configured_not_sending',
    },
    esign: {
      enabled: asBoolean(esign.enabled, fallback.esign.enabled),
      provider: provider === 'docuseal' || provider === 'hellosign' || provider === 'other' ? provider : null,
      configured: asBoolean(esign.configured, fallback.esign.configured),
      status: 'configured_not_sending',
    },
    outboundWebhooks: {
      offerCreated: asText(hooks.offerCreated, 500),
      replyParsed: asText(hooks.replyParsed, 500),
      submissionFailed: asText(hooks.submissionFailed, 500),
      renewalSurfaced: asText(hooks.renewalSurfaced, 500),
    },
  }
}

function parseDocuments(value: unknown, fallback: McaOnboardingDocuments): McaOnboardingDocuments {
  if (!isRecord(value)) return { ...fallback }
  return {
    stampDestinationFunder: asBoolean(value.stampDestinationFunder, fallback.stampDestinationFunder),
    watermarkEnabled: asBoolean(value.watermarkEnabled, fallback.watermarkEnabled),
    uploadLinksEnabled: asBoolean(value.uploadLinksEnabled, fallback.uploadLinksEnabled),
    uploadLinkTtlHours: resolveUploadTtlHours(value.uploadLinkTtlHours ?? fallback.uploadLinkTtlHours),
  }
}

function parseFirstDeal(value: unknown, fallback: McaOnboardingFirstDeal): McaOnboardingFirstDeal {
  if (!isRecord(value)) return { ...fallback, selectedFunderIds: [...fallback.selectedFunderIds] }
  const selectedFunderIds = Array.isArray(value.selectedFunderIds)
    ? value.selectedFunderIds.map(asUuid).filter((id): id is string => Boolean(id))
    : fallback.selectedFunderIds
  return {
    dealExists: asBoolean(value.dealExists, fallback.dealExists),
    rescored: asBoolean(value.rescored, fallback.rescored),
    selectedFunderIds,
    submitted: asBoolean(value.submitted, fallback.submitted),
    sampleReplyPosted: asBoolean(value.sampleReplyPosted, fallback.sampleReplyPosted),
    skippedWithWarning: asBoolean(value.skippedWithWarning, fallback.skippedWithWarning),
  }
}

export function parseGettingStarted(value: unknown, fallback = EMPTY_GETTING_STARTED): McaGettingStartedState {
  if (!isRecord(value)) return { ...fallback }
  const rawStep = value.currentStep
  const currentStep = typeof rawStep === 'number' && Number.isInteger(rawStep)
    ? Math.max(0, Math.min(20, rawStep))
    : fallback.currentStep
  return {
    dismissedAt: asText(value.dismissedAt, 40),
    completedAt: asText(value.completedAt, 40),
    currentStep,
  }
}

export function parseOnboardingState(value: unknown, now = new Date()): McaOnboardingState {
  const empty = createEmptyOnboardingState(now)
  if (!isRecord(value)) return empty
  const skipped = Array.isArray(value.skipped)
    ? value.skipped.filter((step): step is McaOnboardingStep => (
      typeof step === 'string' && (MCA_ONBOARDING_STEPS as readonly string[]).includes(step)
    ))
    : []
  return {
    step: asStep(value.step),
    completedAt: asText(value.completedAt, 40),
    skipped,
    shop: parseShop(value.shop, empty.shop),
    seats: parseSeats(value.seats),
    intake: parseIntake(value.intake, empty.intake),
    fundersImported: asBoolean(value.fundersImported, false),
    senders: parseSenders(value.senders),
    extras: parseExtras(value.extras, empty.extras),
    documents: parseDocuments(value.documents, empty.documents),
    firstDeal: parseFirstDeal(value.firstDeal, empty.firstDeal),
    firstDealId: asUuid(value.firstDealId),
    defaultOriginatorUserId: asUuid(value.defaultOriginatorUserId),
    plan: asText(value.plan, 40) ?? MCA_ONBOARDING_PLAN,
    trialEndsAt: asText(value.trialEndsAt, 40) ?? empty.trialEndsAt,
    gettingStarted: parseGettingStarted(value.gettingStarted),
  }
}

export function mergeOnboardingState(
  current: McaOnboardingState,
  patch: Partial<McaOnboardingState> | Record<string, unknown>,
  now = new Date(),
): McaOnboardingState {
  const parsedPatch = parseOnboardingState({ ...current, ...patch }, now)
  return {
    ...current,
    ...parsedPatch,
    shop: parseShop((patch as { shop?: unknown }).shop ?? current.shop, current.shop),
    seats: 'seats' in patch ? parsedPatch.seats : current.seats,
    intake: parseIntake((patch as { intake?: unknown }).intake ?? current.intake, current.intake),
    senders: 'senders' in patch ? parsedPatch.senders : current.senders,
    extras: parseExtras((patch as { extras?: unknown }).extras ?? current.extras, current.extras),
    documents: parseDocuments((patch as { documents?: unknown }).documents ?? current.documents, current.documents),
    firstDeal: parseFirstDeal((patch as { firstDeal?: unknown }).firstDeal ?? current.firstDeal, current.firstDeal),
    skipped: 'skipped' in patch ? parsedPatch.skipped : current.skipped,
    plan: current.plan || MCA_ONBOARDING_PLAN,
    trialEndsAt: current.trialEndsAt ?? parsedPatch.trialEndsAt,
    gettingStarted: parseGettingStarted(
      (patch as { gettingStarted?: unknown }).gettingStarted ?? current.gettingStarted,
      current.gettingStarted,
    ),
  }
}

export function shopProfileComplete(shop: McaOnboardingShop): boolean {
  return Boolean(shop.legalName || shop.dbaName) && Boolean(shop.primaryState) && Boolean(shop.timezone)
}

export function peopleStepComplete(state: McaOnboardingState): boolean {
  const admins = state.seats.filter((seat) => seat.floor === 'admin')
  const senders = state.senders.length > 0 || state.seats.some((seat) => Boolean(seat.fromAddress))
  return admins.length > 0 && (state.seats.length > 0 || senders)
}

export function intakePathComplete(state: McaOnboardingState): boolean {
  if (state.intake.source === 'spreadsheet') return true
  if (state.intake.source === 'unsure') return state.skipped.includes('intake')
  if (!state.intake.source) return false
  return state.intake.secretIssued || Boolean(state.intake.testedDealId)
}

export function firstDealComplete(state: McaOnboardingState): boolean {
  return Boolean(state.firstDealId) || state.firstDeal.dealExists || state.firstDeal.skippedWithWarning
}

export function isOnboardingComplete(state: McaOnboardingState): boolean {
  if (state.completedAt) return true
  return shopProfileComplete(state.shop)
    && peopleStepComplete(state)
    && (intakePathComplete(state) || firstDealComplete(state))
}

export function resumeOnboardingStep(state: McaOnboardingState): McaOnboardingStep {
  if (state.completedAt) return 'first_deal'
  return state.step
}

export function markStepCompleted(
  state: McaOnboardingState,
  step: McaOnboardingStep,
  nextStep?: McaOnboardingStep,
): McaOnboardingState {
  const index = MCA_ONBOARDING_STEPS.indexOf(step)
  const fallback = MCA_ONBOARDING_STEPS[Math.min(index + 1, MCA_ONBOARDING_STEPS.length - 1)] ?? 'first_deal'
  return {
    ...state,
    step: nextStep ?? fallback,
    skipped: state.skipped.filter((item) => item !== step),
  }
}

export function skipOnboardingStep(state: McaOnboardingState, step: McaOnboardingStep): McaOnboardingState {
  const next = markStepCompleted(state, step)
  return {
    ...next,
    skipped: next.skipped.includes(step) ? next.skipped : [...next.skipped, step],
  }
}

export function completeOnboarding(state: McaOnboardingState, now = new Date()): McaOnboardingState {
  return {
    ...state,
    completedAt: now.toISOString(),
    step: 'first_deal',
    gettingStarted: { ...EMPTY_GETTING_STARTED },
  }
}

export function restartOnboarding(state: McaOnboardingState): McaOnboardingState {
  return {
    ...state,
    step: 'welcome',
    completedAt: null,
    gettingStarted: { ...EMPTY_GETTING_STARTED },
  }
}

export function onboardingStatusChips(input: {
  state: McaOnboardingState
  funderCount: number
}): McaOnboardingStatusChips {
  const extrasOn = input.state.extras.sms.enabled
    || input.state.extras.esign.enabled
    || Boolean(input.state.extras.outboundWebhooks.offerCreated)
    || Boolean(input.state.extras.outboundWebhooks.replyParsed)
    || Boolean(input.state.extras.outboundWebhooks.submissionFailed)
    || Boolean(input.state.extras.outboundWebhooks.renewalSurfaced)
  return {
    intakeConnected: intakePathComplete(input.state) && input.state.intake.source !== 'unsure',
    funderCount: input.funderCount,
    senderCount: input.state.senders.length,
    extrasOn,
    completed: Boolean(input.state.completedAt),
  }
}

export function assertPeopleStep(state: McaOnboardingState): { ok: true } | { ok: false; reason: 'no_admins' } {
  if (!state.seats.some((seat) => seat.floor === 'admin')) return { ok: false, reason: 'no_admins' }
  return { ok: true }
}

export { MCA_ONBOARDING_STEPS }
