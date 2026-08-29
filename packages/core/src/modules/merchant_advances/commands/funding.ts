import { randomUUID } from 'crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { extractUndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { emitCrudSideEffects, emitCrudUndoSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { CrudHttpError, conflict, notFound } from '@open-mercato/shared/lib/crud/errors'
import { enforceCommandOptimisticLock } from '@open-mercato/shared/lib/crud/optimistic-lock-command'
import type { CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { McaCommission, McaCommissionSplit, McaDeal, McaFunding, McaOffer } from '../data/entities'
import { fundingCreateSchema, type FundingCreateInput } from '../data/validators'
import { emitMerchantAdvancesEvent } from '../events'
import {
  createFundingFromOffer,
  FUNDING_MISSING_TERMS,
  FUNDING_SPLIT_POINTS_MISMATCH,
  MCA_DEFAULT_COMMISSION_CURRENCY,
  type FundingComputation,
} from '../lib/funding'
import { canTransition } from '../lib/pipeline'

const FUNDING_COMMAND_ID = 'merchant_advances.fundings.create'

const fundingCrudEvents: CrudEventsConfig = {
  module: 'merchant_advances',
  entity: 'funding',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

const dealCrudEvents: CrudEventsConfig = {
  module: 'merchant_advances',
  entity: 'deal',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

const fundingIndexer: CrudIndexerConfig = {
  entityType: 'merchant_advances:mca_funding',
}

const dealIndexer: CrudIndexerConfig = {
  entityType: 'merchant_advances:mca_deal',
}

type Scope = {
  organizationId: string
  tenantId: string
}

type DealOfferSnapshot = {
  dealId: string
  dealStatus: string
  offerId: string
  offerStatus: string
}

type CreatedFundingSnapshot = {
  fundingId: string
  commissionId: string
  splitIds: string[]
  organizationId: string
  tenantId: string
  dealId: string
  offerId: string
}

type FundingUndoPayload = {
  before?: DealOfferSnapshot | null
  after?: CreatedFundingSnapshot | null
}

export type CreateFundingResult = {
  id: string
  fundingId: string
  commissionId: string
  splitIds: string[]
  dealId: string
  offerId: string
} & FundingComputation

function resolveScope(parsed: FundingCreateInput, ctx: { selectedOrganizationId?: string | null; auth?: { orgId?: string | null; tenantId?: string | null } | null }): Scope {
  const organizationId = parsed.organizationId ?? ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  const tenantId = parsed.tenantId ?? ctx.auth?.tenantId ?? null
  if (!organizationId || !tenantId) {
    throw new CrudHttpError(400, { error: '[internal] merchant advances scope is missing' })
  }
  return { organizationId, tenantId }
}

function parseFundedAt(value: string | null | undefined): Date {
  if (!value) return new Date()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new CrudHttpError(400, { error: '[internal] invalid fundedAt' })
  }
  return date
}

async function translateError(key: string, fallback: string): Promise<string> {
  const { translate } = await resolveTranslations()
  return translate(key, fallback)
}

const createFundingCommand: CommandHandler<FundingCreateInput, CreateFundingResult> = {
  id: FUNDING_COMMAND_ID,
  async prepare(rawInput, ctx) {
    const parsed = fundingCreateSchema.parse(rawInput)
    const scope = resolveScope(parsed, ctx)
    ensureTenantScope(ctx, scope.tenantId)
    ensureOrganizationScope(ctx, scope.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const offer = await em.findOne(McaOffer, {
      id: parsed.offerId,
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      deletedAt: null,
    })
    if (!offer) return {}
    const deal = await findOneWithDecryption(
      em,
      McaDeal,
      { id: offer.dealId, organizationId: scope.organizationId, tenantId: scope.tenantId, deletedAt: null },
      {},
      { tenantId: scope.tenantId, organizationId: scope.organizationId },
    )
    if (!deal) return {}
    return {
      before: {
        dealId: deal.id,
        dealStatus: deal.pipelineStatus,
        offerId: offer.id,
        offerStatus: offer.status,
      } satisfies DealOfferSnapshot,
    }
  },
  async execute(rawInput, ctx) {
    const parsed = fundingCreateSchema.parse(rawInput)
    const scope = resolveScope(parsed, ctx)
    ensureTenantScope(ctx, scope.tenantId)
    ensureOrganizationScope(ctx, scope.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const offer = await em.findOne(McaOffer, {
      id: parsed.offerId,
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      deletedAt: null,
    })
    if (!offer) {
      throw notFound(await translateError('merchant_advances.errors.offerNotFound', 'Offer not found.'))
    }
    const deal = await findOneWithDecryption(
      em,
      McaDeal,
      { id: offer.dealId, organizationId: scope.organizationId, tenantId: scope.tenantId, deletedAt: null },
      {},
      { tenantId: scope.tenantId, organizationId: scope.organizationId },
    )
    if (!deal) {
      throw notFound(await translateError('merchant_advances.errors.dealNotFound', 'Deal not found.'))
    }

    enforceCommandOptimisticLock({
      resourceKind: 'merchant_advances.deal',
      resourceId: deal.id,
      current: deal.updatedAt,
      expected: parsed.dealUpdatedAt,
      request: ctx.request,
    })
    if (parsed.offerUpdatedAt) {
      enforceCommandOptimisticLock({
        resourceKind: 'merchant_advances.offer',
        resourceId: offer.id,
        current: offer.updatedAt,
        expected: parsed.offerUpdatedAt,
      })
    }

    if (offer.status !== 'open') {
      throw new CrudHttpError(400, {
        error: await translateError('merchant_advances.errors.offerNotOpen', 'Only open offers can be funded.'),
      })
    }

    const existing = await em.findOne(McaFunding, {
      $or: [{ dealId: deal.id }, { offerId: offer.id }],
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      deletedAt: null,
    })
    if (existing) {
      throw conflict(await translateError('merchant_advances.errors.alreadyFunded', 'This deal is already funded.'))
    }

    if (!canTransition(deal.pipelineStatus, 'funded')) {
      throw new CrudHttpError(400, {
        error: await translateError('merchant_advances.errors.cannotFundStage', 'This deal cannot move to funded from its current stage.'),
      })
    }

    let computed: FundingComputation
    try {
      computed = createFundingFromOffer(
        {
          amount: offer.amount,
          factor: offer.factor,
          termMonths: offer.termMonths,
          paymentFrequency: offer.paymentFrequency,
          commissionPoints: offer.commissionPoints,
          ownerUserId: deal.ownerUserId,
        },
        {
          fundedAmount: parsed.fundedAmount,
          splits: parsed.splits,
        },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message === FUNDING_SPLIT_POINTS_MISMATCH) {
        throw new CrudHttpError(400, {
          error: await translateError('merchant_advances.errors.splitPointsMismatch', 'Commission split points must equal the offer points.'),
        })
      }
      if (message === FUNDING_MISSING_TERMS || message.startsWith('[internal]')) {
        throw new CrudHttpError(400, {
          error: await translateError('merchant_advances.errors.invalidOfferTerms', 'Offer is missing amount, factor, or term months.'),
        })
      }
      throw error
    }

    const previousDealStatus = deal.pipelineStatus
    const fundedAt = parseFundedAt(parsed.fundedAt)
    const fundingId = randomUUID()
    const commissionId = randomUUID()
    const splitIds = computed.splits.map(() => randomUUID())
    const currency = parsed.currency?.trim() || MCA_DEFAULT_COMMISSION_CURRENCY

    await withAtomicFlush(
      em,
      [
        () => {
          deal.pipelineStatus = 'funded'
          offer.status = 'accepted'
          if (offer.paymentAmount !== computed.paymentAmount) offer.paymentAmount = computed.paymentAmount
          if (offer.paymentFrequency !== computed.paymentFrequency) offer.paymentFrequency = computed.paymentFrequency
          em.persist(em.create(McaFunding, {
            id: fundingId,
            organizationId: scope.organizationId,
            tenantId: scope.tenantId,
            dealId: deal.id,
            offerId: offer.id,
            fundedAmount: computed.fundedAmount,
            fundedAt,
            termMonths: computed.termMonths,
            paymentFrequency: computed.paymentFrequency,
            paymentAmount: computed.paymentAmount,
            paybackAmount: computed.paybackAmount,
            paidInPct: '0.00',
          }))
          em.persist(em.create(McaCommission, {
            id: commissionId,
            organizationId: scope.organizationId,
            tenantId: scope.tenantId,
            fundingId,
            dealId: deal.id,
            points: computed.commissionPoints,
            amount: computed.commissionAmount,
            currency,
          }))
          computed.splits.forEach((split, index) => {
            em.persist(em.create(McaCommissionSplit, {
              id: splitIds[index],
              organizationId: scope.organizationId,
              tenantId: scope.tenantId,
              commissionId,
              userId: split.userId,
              role: split.role,
              points: split.points,
              amount: split.amount,
            }))
          })
        },
      ],
      { transaction: true, label: FUNDING_COMMAND_ID },
    )

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: { id: fundingId },
      identifiers: {
        id: fundingId,
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
      },
      events: fundingCrudEvents,
      indexer: fundingIndexer,
    })
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: deal,
      identifiers: {
        id: deal.id,
        organizationId: deal.organizationId,
        tenantId: deal.tenantId,
      },
      events: dealCrudEvents,
      indexer: dealIndexer,
    })
    await emitMerchantAdvancesEvent(
      'merchant_advances.deal.funded',
      {
        id: deal.id,
        organizationId: deal.organizationId,
        tenantId: deal.tenantId,
        fundingId,
        offerId: offer.id,
      },
      { persistent: true },
    )
    if (previousDealStatus !== 'funded') {
      await emitMerchantAdvancesEvent(
        'merchant_advances.deal.stage_changed',
        {
          id: deal.id,
          organizationId: deal.organizationId,
          tenantId: deal.tenantId,
          from: previousDealStatus,
          to: 'funded',
        },
        { persistent: true },
      )
    }

    return {
      id: fundingId,
      fundingId,
      commissionId,
      splitIds,
      dealId: deal.id,
      offerId: offer.id,
      ...computed,
    }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const funding = await em.findOne(McaFunding, { id: result.fundingId })
    return {
      fundingId: result.fundingId,
      commissionId: result.commissionId,
      splitIds: result.splitIds,
      organizationId: funding?.organizationId ?? ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? '',
      tenantId: funding?.tenantId ?? ctx.auth?.tenantId ?? '',
      dealId: result.dealId,
      offerId: result.offerId,
    } satisfies CreatedFundingSnapshot
  },
  buildLog: async ({ result, snapshots }) => {
    const before = (snapshots.before as DealOfferSnapshot | undefined) ?? null
    const after = (snapshots.after as CreatedFundingSnapshot | undefined) ?? {
      fundingId: result.fundingId,
      commissionId: result.commissionId,
      splitIds: result.splitIds,
      organizationId: '',
      tenantId: '',
      dealId: result.dealId,
      offerId: result.offerId,
    }
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('merchant_advances.audit.funding.create', 'Fund MCA offer'),
      resourceKind: 'merchant_advances.funding',
      resourceId: result.fundingId,
      tenantId: after.tenantId || null,
      organizationId: after.organizationId || null,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: {
        undo: { before, after } satisfies FundingUndoPayload,
      },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<FundingUndoPayload>(logEntry)
    const after = payload?.after
    const before = payload?.before
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const funding = await em.findOne(McaFunding, { id: after.fundingId, deletedAt: null })
    if (!funding) return
    const commission = await em.findOne(McaCommission, { fundingId: funding.id, deletedAt: null })
    const splits = commission
      ? await em.find(McaCommissionSplit, { commissionId: commission.id, deletedAt: null })
      : []
    const deal = await findOneWithDecryption(
      em,
      McaDeal,
      { id: funding.dealId, deletedAt: null },
      {},
      { tenantId: funding.tenantId, organizationId: funding.organizationId },
    )
    const offer = funding.offerId
      ? await em.findOne(McaOffer, { id: funding.offerId, deletedAt: null })
      : null
    const now = new Date()

    await withAtomicFlush(
      em,
      [
        () => {
          funding.deletedAt = now
          if (commission) commission.deletedAt = now
          for (const split of splits) split.deletedAt = now
          if (deal && before?.dealStatus) deal.pipelineStatus = before.dealStatus as typeof deal.pipelineStatus
          if (offer && before?.offerStatus) offer.status = before.offerStatus as typeof offer.status
        },
      ],
      { transaction: true, label: `${FUNDING_COMMAND_ID}.undo` },
    )

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: funding,
      identifiers: {
        id: funding.id,
        organizationId: funding.organizationId,
        tenantId: funding.tenantId,
      },
      events: fundingCrudEvents,
      indexer: fundingIndexer,
    })
    if (deal) {
      await emitCrudUndoSideEffects({
        dataEngine: de,
        action: 'updated',
        entity: deal,
        identifiers: {
          id: deal.id,
          organizationId: deal.organizationId,
          tenantId: deal.tenantId,
        },
        events: dealCrudEvents,
        indexer: dealIndexer,
      })
    }
  },
}

registerCommand(createFundingCommand)
