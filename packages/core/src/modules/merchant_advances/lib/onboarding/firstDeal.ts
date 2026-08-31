import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { McaDeal, McaFunder } from '../../data/entities'
import type { IntakeCommandInput, OnboardingActionInput } from '../../data/validators'
import { executeDealIntake } from '../intake/executeIntake'
import { buildSunsetDinerIntakePayload, HARBOR_SAMPLE_REPLY, stripRemoteStatementUrls } from './fixture'
import { SUNSET_DINER_FIXTURE, type McaOnboardingFirstDeal } from './types'

export const MCA_FIRST_DEAL_ACTIONS = ['ensure', 'score', 'select', 'submit', 'reply', 'skip'] as const
export type McaFirstDealAction = (typeof MCA_FIRST_DEAL_ACTIONS)[number]

export function firstDealWouldSubmit(action: McaFirstDealAction): boolean {
  return action === 'submit'
}

export function applyFirstDealChecklist(
  current: McaOnboardingFirstDeal,
  action: McaFirstDealAction,
  funderIds?: string[],
): McaOnboardingFirstDeal {
  const selectedFunderIds = funderIds ?? current.selectedFunderIds
  return {
    dealExists: current.dealExists || action === 'ensure' || action === 'score' || action === 'select' || action === 'submit' || action === 'reply',
    rescored: current.rescored || action === 'score',
    selectedFunderIds: action === 'select' ? selectedFunderIds : current.selectedFunderIds,
    submitted: current.submitted || action === 'submit',
    sampleReplyPosted: current.sampleReplyPosted || action === 'reply',
    skippedWithWarning: current.skippedWithWarning || action === 'skip',
  }
}

export async function findOrCreateSunsetDiner(input: {
  em: EntityManager
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  tenantId: string
  organizationId: string
  existingDealId?: string | null
}): Promise<{ dealId: string; created: boolean; submitted: false }> {
  if (input.existingDealId) {
    const existing = await input.em.findOne(McaDeal, {
      id: input.existingDealId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      deletedAt: null,
    })
    if (existing) return { dealId: existing.id, created: false, submitted: false }
  }
  const reused = await input.em.findOne(McaDeal, {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    businessName: SUNSET_DINER_FIXTURE.businessName,
    deletedAt: null,
  })
  if (reused) return { dealId: reused.id, created: false, submitted: false }

  const payload = stripRemoteStatementUrls({
    ...buildSunsetDinerIntakePayload(),
    organizationId: input.organizationId,
    tenantId: input.tenantId,
  } as Record<string, unknown>)
  const result = await executeDealIntake({
    commandBus: input.commandBus,
    ctx: input.ctx,
    commandInput: payload as unknown as IntakeCommandInput,
  })
  return { dealId: result.dealId, created: true, submitted: false }
}

export async function resolveHarborFunderId(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
): Promise<string | null> {
  const harbor = await em.findOne(McaFunder, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    code: 'harbor',
    deletedAt: null,
  })
  return harbor?.id ?? null
}

export function buildHarborReplyInput(dealId: string, funderId: string | null): Record<string, unknown> {
  return {
    ...HARBOR_SAMPLE_REPLY,
    dealId,
    funderId,
  }
}

export function parseFirstDealAction(input: OnboardingActionInput): McaFirstDealAction {
  const action = input.action ?? (input.skipWithWarning ? 'skip' : 'ensure')
  if (!(MCA_FIRST_DEAL_ACTIONS as readonly string[]).includes(action)) {
    throw new CrudHttpError(400, { error: '[internal] MCA first-deal action is invalid' })
  }
  return action
}
