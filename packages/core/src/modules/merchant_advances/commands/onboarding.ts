import { randomBytes } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { enforceCommandOptimisticLockWithGuards } from '@open-mercato/shared/lib/crud/optimistic-lock-command'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { McaFunder, McaWorkspaceSettings } from '../data/entities'
import {
  funderCsvImportSchema,
  onboardingActionSchema,
  onboardingSaveSchema,
  type FunderCsvImportInput,
  type OnboardingActionInput,
  type OnboardingSaveInput,
} from '../data/validators'
import { emitMerchantAdvancesEvent } from '../events'
import { SEEDED_FUNDER_CRITERIA } from '../lib/seedFunders'
import { tryResolve } from '../lib/intake/tryResolve'
import {
  completeOnboarding,
  markStepCompleted,
  mergeOnboardingState,
  parseOnboardingState,
  restartOnboarding,
  skipOnboardingStep,
  assertPeopleStep,
} from '../lib/onboarding/state'
import { onboardingStatusChips } from '../lib/onboarding/state'
import { generateIntakeSecret } from '../lib/onboarding/secret'
import { previewFunderCsv, readyFunderCsvRows, routeToSubmitMethod } from '../lib/onboarding/funderCsv'
import { buildSunsetDinerIntakePayload, stripRemoteStatementUrls } from '../lib/onboarding/fixture'
import type { McaOnboardingState } from '../lib/onboarding/types'
import { MCA_CONFIG_INTAKE_SECRET, loadIntakeWebhookSecret, loadIntakeWorkspaceConfig } from './settings'
import { executeDealIntake } from '../lib/intake/executeIntake'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import type { CacheStrategy } from '@open-mercato/cache'
import type { IntakeCommandInput } from '../data/validators'
import { issueUploadToken, persistUploadTokenHash } from '../lib/intake/uploadLinks'
import {
  applyFirstDealChecklist,
  buildHarborReplyInput,
  findOrCreateSunsetDiner,
  firstDealWouldSubmit,
  parseFirstDealAction,
  resolveHarborFunderId,
} from '../lib/onboarding/firstDeal'

export const MCA_ONBOARDING_RESOURCE_KIND = 'merchant_advances.onboarding'
export const MCA_CONFIG_SMS_KEY = 'extras.sms.apiKey'
export const MCA_CONFIG_ESIGN_KEY = 'extras.esign.apiKey'

export type OnboardingSaveResult = {
  onboarding: McaOnboardingState
  plan: string
  trialEndsAt: string | null
  intakeSecret: string | null
  intakeWebhookSecretConfigured: boolean
  chips: ReturnType<typeof onboardingStatusChips>
  updatedAt: string
}

function parseSaveInput(raw: unknown): OnboardingSaveInput {
  const parsed = onboardingSaveSchema.safeParse(raw)
  if (!parsed.success) {
    throw new CrudHttpError(400, { error: '[internal] MCA onboarding input is invalid' })
  }
  return parsed.data
}

export async function loadWorkspaceSettings(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
): Promise<McaWorkspaceSettings> {
  let settings = await em.findOne(McaWorkspaceSettings, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  })
  if (!settings) {
    settings = em.create(McaWorkspaceSettings, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })
    em.persist(settings)
  }
  return settings
}

export function settingsOnboardingState(settings: McaWorkspaceSettings, now = new Date()): McaOnboardingState {
  const state = parseOnboardingState(settings.onboarding, now)
  if (!settings.plan) settings.plan = state.plan
  if (!settings.trialEndsAt && state.trialEndsAt) settings.trialEndsAt = new Date(state.trialEndsAt)
  return {
    ...state,
    plan: settings.plan ?? state.plan,
    trialEndsAt: settings.trialEndsAt?.toISOString() ?? state.trialEndsAt,
  }
}

async function persistOnboarding(
  settings: McaWorkspaceSettings,
  state: McaOnboardingState,
  em: EntityManager,
): Promise<McaOnboardingState> {
  settings.onboarding = state as unknown as Record<string, unknown>
  settings.plan = state.plan
  settings.trialEndsAt = state.trialEndsAt ? new Date(state.trialEndsAt) : settings.trialEndsAt
  if (state.shop.defaultFromAddress) settings.defaultFromAddress = state.shop.defaultFromAddress
  if (state.shop.brokerLogoAttachmentId) settings.brokerLogoAttachmentId = state.shop.brokerLogoAttachmentId
  if (state.documents.watermarkEnabled !== undefined) settings.watermarkEnabled = state.documents.watermarkEnabled
  await em.flush()
  return state
}

async function loadSecretFlags(
  resolver: { resolve: <T = unknown>(name: string) => T },
  scope: { tenantId: string; organizationId: string },
) {
  const service = tryResolve<ModuleConfigService>(resolver, 'moduleConfigService')
  const intake = await loadIntakeWebhookSecret(resolver, scope)
  const sms = service ? await service.getValue<string>('merchant_advances', MCA_CONFIG_SMS_KEY, { scope }) : null
  const esign = service ? await service.getValue<string>('merchant_advances', MCA_CONFIG_ESIGN_KEY, { scope }) : null
  return {
    intake,
    smsConfigured: typeof sms === 'string' && sms.trim().length > 0,
    esignConfigured: typeof esign === 'string' && esign.trim().length > 0,
  }
}

const saveOnboardingCommand: CommandHandler<OnboardingSaveInput, OnboardingSaveResult> = {
  id: 'merchant_advances.onboarding.save',
  async execute(rawInput, ctx) {
    const input = parseSaveInput(rawInput)
    ensureTenantScope(ctx, input.tenantId)
    ensureOrganizationScope(ctx, input.organizationId)
    const scope = { tenantId: input.tenantId, organizationId: input.organizationId }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let settings = await em.findOne(McaWorkspaceSettings, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    })
    if (!settings) {
      settings = em.create(McaWorkspaceSettings, {
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      })
      em.persist(settings)
    } else {
      await enforceCommandOptimisticLockWithGuards(ctx.container, {
        resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
        resourceId: settings.id,
        current: settings.updatedAt,
        request: ctx.request ?? null,
      })
    }
    const previous = settingsOnboardingState(settings)
    let next = mergeOnboardingState(previous, input)
    const previousStep = previous.step

    if (input.skipStep) next = skipOnboardingStep(next, input.skipStep)
    else if (input.step && input.step !== previous.step) next = markStepCompleted(next, previous.step, input.step)

    if (input.seats) {
      const people = assertPeopleStep(next)
      if (!people.ok && input.step && ['funders', 'documents', 'extras', 'first_deal'].includes(input.step)) {
        throw new CrudHttpError(400, { error: '[internal] MCA onboarding requires at least one admin' })
      }
      next = {
        ...next,
        senders: next.seats
          .filter((seat) => Boolean(seat.fromAddress))
          .map((seat) => ({ userId: seat.userId, fromAddress: seat.fromAddress as string })),
      }
    }

    if (input.restart) next = restartOnboarding(next)
    else if (input.complete) next = completeOnboarding(next)

    await persistOnboarding(settings, next, em)

    const extras = input.extras as { smsApiKey?: string; esignApiKey?: string } | undefined
    const configService = tryResolve<ModuleConfigService>(ctx.container, 'moduleConfigService')
    if (configService && extras?.smsApiKey) {
      await configService.setValue('merchant_advances', MCA_CONFIG_SMS_KEY, extras.smsApiKey, scope)
      next = mergeOnboardingState(next, { extras: { ...next.extras, sms: { ...next.extras.sms, configured: true, enabled: true } } })
    }
    if (configService && extras?.esignApiKey) {
      await configService.setValue('merchant_advances', MCA_CONFIG_ESIGN_KEY, extras.esignApiKey, scope)
      next = mergeOnboardingState(next, { extras: { ...next.extras, esign: { ...next.extras.esign, configured: true, enabled: true } } })
    }
    if (configService && (next.documents.uploadLinkTtlHours || next.documents.uploadLinksEnabled !== undefined)) {
      const current = await loadIntakeWorkspaceConfig(ctx.container, scope)
      await configService.setValue('merchant_advances', 'intake.uploadLinks', {
        uploadLinksEnabled: next.documents.uploadLinksEnabled,
        uploadLinkTtlHours: next.documents.uploadLinkTtlHours || current.uploadLinkTtlHours,
      }, scope)
    }

    if (next.shop.defaultFromAddress || next.documents.watermarkEnabled !== previous.documents.watermarkEnabled) {
      await persistOnboarding(settings, next, em)
    }

    const funderCount = await em.count(McaFunder, { tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null })
    const secrets = await loadSecretFlags(ctx.container, scope)
    next = mergeOnboardingState(next, {
      extras: {
        ...next.extras,
        sms: { ...next.extras.sms, configured: secrets.smsConfigured || next.extras.sms.configured },
        esign: { ...next.extras.esign, configured: secrets.esignConfigured || next.extras.esign.configured },
      },
      intake: { ...next.intake, secretIssued: Boolean(secrets.intake) || next.intake.secretIssued },
    })

    if (previousStep !== next.step) {
      try {
        await emitMerchantAdvancesEvent('merchant_advances.onboarding.step_completed', {
          step: previousStep,
          nextStep: next.step,
          organizationId: scope.organizationId,
          tenantId: scope.tenantId,
        })
      } catch {
        // event bus is optional in tests
      }
    }
    if (!previous.completedAt && next.completedAt) {
      try {
        await emitMerchantAdvancesEvent('merchant_advances.onboarding.completed', {
          organizationId: scope.organizationId,
          tenantId: scope.tenantId,
          firstDealId: next.firstDealId,
        })
      } catch {
        // event bus is optional in tests
      }
    }

    return {
      onboarding: next,
      plan: next.plan,
      trialEndsAt: next.trialEndsAt,
      intakeSecret: null,
      intakeWebhookSecretConfigured: Boolean(secrets.intake),
      chips: onboardingStatusChips({ state: next, funderCount }),
      updatedAt: settings.updatedAt.toISOString(),
    }
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('merchant_advances.audit.onboardingSave', 'Save MCA onboarding'),
      resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
      resourceId: result.onboarding.firstDealId ?? result.updatedAt,
    }
  },
}

const rotateSecretCommand: CommandHandler<{ organizationId: string; tenantId: string }, { secret: string }> = {
  id: 'merchant_advances.onboarding.rotate_secret',
  async execute(rawInput, ctx) {
    const input = parseSaveInput({ ...rawInput, step: undefined })
    ensureTenantScope(ctx, input.tenantId)
    ensureOrganizationScope(ctx, input.organizationId)
    const scope = { tenantId: input.tenantId, organizationId: input.organizationId }
    const secret = generateIntakeSecret()
    const configService = tryResolve<ModuleConfigService>(ctx.container, 'moduleConfigService')
    if (configService) {
      await configService.setValue('merchant_advances', MCA_CONFIG_INTAKE_SECRET, secret, scope)
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const settings = await loadWorkspaceSettings(em, scope)
    const next = mergeOnboardingState(settingsOnboardingState(settings), {
      intake: { ...settingsOnboardingState(settings).intake, secretIssued: true },
    })
    await persistOnboarding(settings, next, em)
    return { secret }
  },
  buildLog: async () => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('merchant_advances.audit.rotateIntakeSecret', 'Rotate MCA intake secret'),
      resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
      resourceId: 'intake-secret',
    }
  },
}

const testIntakeCommand: CommandHandler<{ organizationId: string; tenantId: string }, { dealId: string; fetchedUrls: false }> = {
  id: 'merchant_advances.onboarding.test_intake',
  async execute(rawInput, ctx) {
    const tenantId = typeof rawInput.tenantId === 'string' ? rawInput.tenantId : ''
    const organizationId = typeof rawInput.organizationId === 'string' ? rawInput.organizationId : ''
    ensureTenantScope(ctx, tenantId)
    ensureOrganizationScope(ctx, organizationId)
    const payload = stripRemoteStatementUrls({
      ...buildSunsetDinerIntakePayload(),
      organizationId,
      tenantId,
    } as Record<string, unknown>)
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const result = await executeDealIntake({
      commandBus,
      ctx,
      commandInput: payload as unknown as IntakeCommandInput,
    })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const settings = await loadWorkspaceSettings(em, { tenantId, organizationId })
    const current = settingsOnboardingState(settings)
    const next = mergeOnboardingState(current, {
      intake: { ...current.intake, testedDealId: result.dealId, secretIssued: current.intake.secretIssued },
      firstDealId: current.firstDealId ?? result.dealId,
      firstDeal: { ...current.firstDeal, dealExists: true },
    })
    await persistOnboarding(settings, next, em)
    return { dealId: result.dealId, fetchedUrls: false }
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('merchant_advances.audit.onboardingTestIntake', 'Test MCA intake fixture'),
      resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
      resourceId: result.dealId,
    }
  },
}

const funderImportCommand: CommandHandler<FunderCsvImportInput, { preview: ReturnType<typeof previewFunderCsv>; createdIds: string[] }> = {
  id: 'merchant_advances.onboarding.import_funders',
  async execute(rawInput, ctx) {
    const parsed = funderCsvImportSchema.safeParse(rawInput)
    if (!parsed.success) throw new CrudHttpError(400, { error: '[internal] MCA funder CSV is invalid' })
    const input = parsed.data
    if (!input.tenantId || !input.organizationId) {
      throw new CrudHttpError(400, { error: '[internal] merchant advances scope is missing' })
    }
    ensureTenantScope(ctx, input.tenantId)
    ensureOrganizationScope(ctx, input.organizationId)
    const preview = previewFunderCsv(input.spreadsheetText)
    if (!input.commit) return { preview, createdIds: [] }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const createdIds: string[] = []
    for (const row of readyFunderCsvRows(preview)) {
      const funder = em.create(McaFunder, {
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        name: row.name,
        code: row.code,
        submitMethod: routeToSubmitMethod(row.route),
        submitEmail: row.submitEmail,
        requiresUnstampedStatements: row.requiresUnstampedStatements,
        supportsStatusPoll: false,
        criteria: {
          ...row.criteria,
          ...(row.fromAddressOverride ? { fromAddressOverride: row.fromAddressOverride } : {}),
        },
      })
      em.persist(funder)
      createdIds.push(funder.id)
    }
    const settings = await loadWorkspaceSettings(em, { tenantId: input.tenantId, organizationId: input.organizationId })
    const next = mergeOnboardingState(settingsOnboardingState(settings), { fundersImported: createdIds.length > 0 || settingsOnboardingState(settings).fundersImported })
    await persistOnboarding(settings, next, em)
    return { preview, createdIds }
  },
  buildLog: async () => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('merchant_advances.audit.importFunders', 'Import MCA funders'),
      resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
      resourceId: 'funders',
    }
  },
}

const seedStarterPanelCommand: CommandHandler<{ organizationId: string; tenantId: string }, { kept: string[] }> = {
  id: 'merchant_advances.onboarding.seed_starter_funders',
  async execute(rawInput, ctx) {
    const tenantId = String(rawInput.tenantId ?? '')
    const organizationId = String(rawInput.organizationId ?? '')
    ensureTenantScope(ctx, tenantId)
    ensureOrganizationScope(ctx, organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const existing = await em.find(McaFunder, {
      tenantId,
      organizationId,
      code: { $in: ['harbor', 'northstar'] },
      deletedAt: null,
    })
    const byCode = new Map(existing.map((funder) => [funder.code, funder]))
    if (!byCode.get('harbor')) {
      em.persist(em.create(McaFunder, {
        tenantId,
        organizationId,
        name: 'Harbor Advance',
        code: 'harbor',
        submitMethod: 'webhook',
        webhookUrl: 'https://example.com/mca-intake',
        criteria: SEEDED_FUNDER_CRITERIA.harbor,
      }))
    } else {
      const harbor = byCode.get('harbor')
      if (harbor) harbor.criteria = { ...SEEDED_FUNDER_CRITERIA.harbor, ...(harbor.criteria ?? {}) }
    }
    if (!byCode.get('northstar')) {
      em.persist(em.create(McaFunder, {
        tenantId,
        organizationId,
        name: 'Northstar Capital',
        code: 'northstar',
        submitMethod: 'email',
        submitEmail: 'submissions@example.com',
        criteria: SEEDED_FUNDER_CRITERIA.northstar,
      }))
    } else {
      const northstar = byCode.get('northstar')
      if (northstar) northstar.criteria = { ...SEEDED_FUNDER_CRITERIA.northstar, ...(northstar.criteria ?? {}) }
    }
    const settings = await loadWorkspaceSettings(em, { tenantId, organizationId })
    await persistOnboarding(settings, mergeOnboardingState(settingsOnboardingState(settings), { fundersImported: true }), em)
    return { kept: ['harbor', 'northstar'] }
  },
  buildLog: async () => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('merchant_advances.audit.seedStarterFunders', 'Use MCA starter funder panel'),
      resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
      resourceId: 'starter-funders',
    }
  },
}

const firstDealCommand: CommandHandler<OnboardingActionInput, {
  dealId: string
  action: ReturnType<typeof parseFirstDealAction>
  submitted: boolean
  matchCount: number | null
  matches: Array<{ funderId: string; score: string | null }>
}> = {
  id: 'merchant_advances.onboarding.first_deal',
  async execute(rawInput, ctx) {
    const parsed = onboardingActionSchema.safeParse(rawInput)
    if (!parsed.success) throw new CrudHttpError(400, { error: '[internal] MCA first-deal input is invalid' })
    const input = parsed.data
    const tenantId = input.tenantId ?? ''
    const organizationId = input.organizationId ?? ''
    ensureTenantScope(ctx, tenantId)
    ensureOrganizationScope(ctx, organizationId)
    const action = parseFirstDealAction(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const settings = await loadWorkspaceSettings(em, { tenantId, organizationId })
    const current = settingsOnboardingState(settings)
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const sunset = await findOrCreateSunsetDiner({
      em,
      commandBus,
      ctx,
      tenantId,
      organizationId,
      existingDealId: input.dealId ?? current.firstDealId,
    })
    let matchCount: number | null = null
    let matches: Array<{ funderId: string; score: string | null }> = []
    if (action === 'score') {
      const refreshed = await commandBus.execute<{ dealId: string; organizationId: string; tenantId: string }, { dealId: string; matchCount: number; topScore: string | null }>(
        'merchant_advances.matches.refresh',
        { input: { dealId: sunset.dealId, organizationId, tenantId }, ctx },
      )
      matchCount = refreshed.result.matchCount
    }
    if (action === 'submit') {
      const funderIds = input.funderIds?.length ? input.funderIds : current.firstDeal.selectedFunderIds
      if (!funderIds.length) {
        throw new CrudHttpError(400, { error: '[internal] MCA first-deal submit requires selected funders' })
      }
      await commandBus.execute(
        'merchant_advances.submissions.send',
        { input: { dealId: sunset.dealId, funderIds, organizationId, tenantId }, ctx },
      )
    }
    if (action === 'reply') {
      const harborId = await resolveHarborFunderId(em, { tenantId, organizationId })
      await commandBus.execute(
        'merchant_advances.replies.ingest',
        { input: { ...buildHarborReplyInput(sunset.dealId, harborId), organizationId, tenantId }, ctx },
      )
    }
    const firstDeal = applyFirstDealChecklist(current.firstDeal, action, input.funderIds)
    const next = mergeOnboardingState(current, {
      firstDealId: sunset.dealId,
      firstDeal,
    })
    await persistOnboarding(settings, next, em)
    return {
      dealId: sunset.dealId,
      action,
      submitted: firstDealWouldSubmit(action),
      matchCount,
      matches,
    }
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('merchant_advances.audit.onboardingFirstDeal', 'MCA first-deal checklist'),
      resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
      resourceId: result.dealId,
    }
  },
}

const uploadLinkCommand: CommandHandler<OnboardingActionInput, { token: string; expiresAt: string; dealId: string; url: string }> = {
  id: 'merchant_advances.onboarding.upload_link',
  async execute(rawInput, ctx) {
    const parsed = onboardingActionSchema.safeParse(rawInput)
    if (!parsed.success) throw new CrudHttpError(400, { error: '[internal] MCA upload-link input is invalid' })
    const tenantId = parsed.data.tenantId ?? ''
    const organizationId = parsed.data.organizationId ?? ''
    ensureTenantScope(ctx, tenantId)
    ensureOrganizationScope(ctx, organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const settings = await loadWorkspaceSettings(em, { tenantId, organizationId })
    const current = settingsOnboardingState(settings)
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const sunset = await findOrCreateSunsetDiner({
      em,
      commandBus,
      ctx,
      tenantId,
      organizationId,
      existingDealId: parsed.data.dealId ?? current.firstDealId,
    })
    const config = await loadIntakeWorkspaceConfig(ctx.container, { tenantId, organizationId })
    const issued = issueUploadToken({
      dealId: sunset.dealId,
      tenantId,
      organizationId,
      classification: 'statement',
      ttlHours: current.documents.uploadLinkTtlHours || config.uploadLinkTtlHours,
    })
    const cache = tryResolve<CacheStrategy>(ctx.container, 'cache')
    await persistUploadTokenHash(cache ?? null, issued)
    const next = mergeOnboardingState(current, {
      firstDealId: sunset.dealId,
      firstDeal: { ...current.firstDeal, dealExists: true },
    })
    await persistOnboarding(settings, next, em)
    return {
      token: issued.token,
      expiresAt: issued.expiresAt.toISOString(),
      dealId: sunset.dealId,
      url: `/api/merchant_advances/intake/upload?token=${encodeURIComponent(issued.token)}`,
    }
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('merchant_advances.audit.onboardingUploadLink', 'Issue MCA test upload link'),
      resourceKind: MCA_ONBOARDING_RESOURCE_KIND,
      resourceId: result.dealId,
    }
  },
}

registerCommand(saveOnboardingCommand)
export { saveOnboardingCommand }
registerCommand(rotateSecretCommand)
registerCommand(testIntakeCommand)
registerCommand(funderImportCommand)
registerCommand(seedStarterPanelCommand)
registerCommand(firstDealCommand)
registerCommand(uploadLinkCommand)

export function randomTokenSuffix(): string {
  return randomBytes(4).toString('hex')
}
