import { randomUUID } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import {
  MCA_DEFAULT_RENEWAL_PAID_IN_THRESHOLD,
  MCA_PAYMENT_FREQUENCIES,
  type McaPaymentFrequency,
  type McaPipelineStatus,
  type McaRenewalStatus,
} from '../data/constants'
import { McaDeal, McaFunding, McaRenewal, McaWorkspaceSettings } from '../data/entities'
import { emitMerchantAdvancesEvent } from '../events'
import { periodCount } from './money'
import { calculatePaidInPct, isApproachingRenewal } from './paidIn'

export const MCA_RENEWAL_REMAINING_DAYS_THRESHOLD = 30
export const MCA_OPEN_PIPELINE_STATUSES: readonly McaPipelineStatus[] = [
  'new_app',
  'statements_in',
  'underwriting',
  'matched',
  'submitted',
  'offered',
  'contracted',
]

const PAYMENT_FREQUENCIES = new Set<string>(MCA_PAYMENT_FREQUENCIES)
const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_WEEK = 7 * MS_PER_DAY
const MS_PER_MONTH = 30.4375 * MS_PER_DAY

export type RenewalSweepScope = {
  tenantId: string
  organizationId: string
}

export type SweepFundingRecord = {
  id: string
  tenantId: string
  organizationId: string
  dealId: string
  merchantCompanyId?: string | null
  fundedAt: Date
  termMonths?: number | null
  paymentFrequency?: string | null
  paidInPct?: string | null
}

export type SweepRenewalRecord = {
  id: string
  tenantId: string
  organizationId: string
  fundingId: string
  dealId: string
  merchantCompanyId?: string | null
  paidInPct?: string | null
  surfacedAt?: Date | null
  status: McaRenewalStatus
}

export type SweepDealRecord = {
  id: string
  tenantId: string
  organizationId: string
  merchantCompanyId?: string | null
  pipelineStatus: McaPipelineStatus
  businessName: string
  merchantNameSnapshot?: string | null
  updatedAt: Date
}

export type RenewalSweepStore = {
  fundings: SweepFundingRecord[]
  renewals: SweepRenewalRecord[]
  deals?: SweepDealRecord[]
}

export type RenewalSweepResult = {
  fundings: SweepFundingRecord[]
  renewals: SweepRenewalRecord[]
  created: SweepRenewalRecord[]
  updated: SweepRenewalRecord[]
  surfaced: SweepRenewalRecord[]
  skippedOtherScope: number
}

function cloneFunding(funding: SweepFundingRecord): SweepFundingRecord {
  return { ...funding, fundedAt: new Date(funding.fundedAt) }
}

function cloneRenewal(renewal: SweepRenewalRecord): SweepRenewalRecord {
  return {
    ...renewal,
    surfacedAt: renewal.surfacedAt ? new Date(renewal.surfacedAt) : renewal.surfacedAt,
  }
}

function inScope(record: { tenantId: string; organizationId: string }, scope: RenewalSweepScope): boolean {
  return record.tenantId === scope.tenantId && record.organizationId === scope.organizationId
}

export function isMcaPaymentFrequency(value: string | null | undefined): value is McaPaymentFrequency {
  return typeof value === 'string' && PAYMENT_FREQUENCIES.has(value)
}

export function formatPaidInPct(value: number): string {
  return value.toFixed(2)
}

export function remainingTermDays(input: {
  fundedAt: Date
  frequency: McaPaymentFrequency
  termMonths: number
  now?: Date
}): number {
  const now = input.now ?? new Date()
  const totalPeriods = periodCount(input.termMonths, input.frequency)
  const msPerPeriod = input.frequency === 'monthly'
    ? MS_PER_MONTH
    : input.frequency === 'weekly'
      ? MS_PER_WEEK
      : MS_PER_DAY
  const remainingMs = input.fundedAt.getTime() + totalPeriods * msPerPeriod - now.getTime()
  return Math.ceil(remainingMs / MS_PER_DAY)
}

export function shouldSurfaceRenewal(
  paidInPct: number,
  remainingDays: number,
  threshold = MCA_DEFAULT_RENEWAL_PAID_IN_THRESHOLD,
): boolean {
  return isApproachingRenewal(paidInPct, threshold) || remainingDays <= MCA_RENEWAL_REMAINING_DAYS_THRESHOLD
}

export function listPastApprovalDeals(deals: SweepDealRecord[], scope: RenewalSweepScope): SweepDealRecord[] {
  const scoped = deals.filter((deal) => inScope(deal, scope))
  const openMerchantIds = new Set(
    scoped
      .filter((deal) => MCA_OPEN_PIPELINE_STATUSES.includes(deal.pipelineStatus) && deal.merchantCompanyId)
      .map((deal) => deal.merchantCompanyId as string),
  )
  const seenMerchants = new Set<string>()
  const result: SweepDealRecord[] = []
  const funded = scoped
    .filter((deal) => deal.pipelineStatus === 'funded')
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
  for (const deal of funded) {
    if (deal.merchantCompanyId) {
      if (openMerchantIds.has(deal.merchantCompanyId)) continue
      if (seenMerchants.has(deal.merchantCompanyId)) continue
      seenMerchants.add(deal.merchantCompanyId)
    }
    result.push(deal)
  }
  return result
}

export function applyRenewalSweep(
  store: RenewalSweepStore,
  options: {
    scope: RenewalSweepScope
    threshold?: number
    now?: Date
    nextId?: (fundingId: string) => string
  },
): RenewalSweepResult {
  const now = options.now ?? new Date()
  const threshold = options.threshold ?? MCA_DEFAULT_RENEWAL_PAID_IN_THRESHOLD
  const nextId = options.nextId ?? (() => randomUUID())
  const fundings = store.fundings.map(cloneFunding)
  const renewals = store.renewals.map(cloneRenewal)
  const created: SweepRenewalRecord[] = []
  const updated: SweepRenewalRecord[] = []
  const surfaced: SweepRenewalRecord[] = []
  let skippedOtherScope = 0

  for (const funding of fundings) {
    if (!inScope(funding, options.scope)) {
      skippedOtherScope += 1
      continue
    }
    if (!isMcaPaymentFrequency(funding.paymentFrequency) || !funding.termMonths || funding.termMonths <= 0) {
      continue
    }
    const paidInPct = calculatePaidInPct({
      fundedAt: funding.fundedAt,
      frequency: funding.paymentFrequency,
      termMonths: funding.termMonths,
      now,
    })
    funding.paidInPct = formatPaidInPct(paidInPct)
    const remainingDays = remainingTermDays({
      fundedAt: funding.fundedAt,
      frequency: funding.paymentFrequency,
      termMonths: funding.termMonths,
      now,
    })
    const existing = renewals.find((row) => (
      row.fundingId === funding.id
      && inScope(row, options.scope)
    ))
    if (!shouldSurfaceRenewal(paidInPct, remainingDays, threshold)) {
      if (existing && existing.paidInPct !== funding.paidInPct) {
        existing.paidInPct = funding.paidInPct
        updated.push(existing)
      }
      continue
    }
    if (!existing) {
      const row: SweepRenewalRecord = {
        id: nextId(funding.id),
        tenantId: options.scope.tenantId,
        organizationId: options.scope.organizationId,
        fundingId: funding.id,
        dealId: funding.dealId,
        merchantCompanyId: funding.merchantCompanyId ?? null,
        paidInPct: funding.paidInPct,
        surfacedAt: now,
        status: 'due',
      }
      renewals.push(row)
      created.push(row)
      surfaced.push(row)
      continue
    }
    const wasWatching = existing.status === 'watching'
    const firstSurface = !existing.surfacedAt
    existing.paidInPct = funding.paidInPct
    if (wasWatching) existing.status = 'due'
    if (firstSurface) existing.surfacedAt = now
    updated.push(existing)
    if (wasWatching || firstSurface) surfaced.push(existing)
  }

  return { fundings, renewals, created, updated, surfaced, skippedOtherScope }
}

function toSweepFunding(funding: McaFunding, merchantCompanyId?: string | null): SweepFundingRecord {
  return {
    id: funding.id,
    tenantId: funding.tenantId,
    organizationId: funding.organizationId,
    dealId: funding.dealId,
    merchantCompanyId: merchantCompanyId ?? null,
    fundedAt: funding.fundedAt,
    termMonths: funding.termMonths ?? null,
    paymentFrequency: funding.paymentFrequency ?? null,
    paidInPct: funding.paidInPct ?? null,
  }
}

function toSweepRenewal(renewal: McaRenewal): SweepRenewalRecord {
  return {
    id: renewal.id,
    tenantId: renewal.tenantId,
    organizationId: renewal.organizationId,
    fundingId: renewal.fundingId,
    dealId: renewal.dealId,
    merchantCompanyId: renewal.merchantCompanyId ?? null,
    paidInPct: renewal.paidInPct ?? null,
    surfacedAt: renewal.surfacedAt ?? null,
    status: renewal.status,
  }
}

export async function resolveRenewalThreshold(
  em: EntityManager,
  scope: RenewalSweepScope,
): Promise<number> {
  const settings = await em.findOne(McaWorkspaceSettings, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  })
  const threshold = settings?.renewalPaidInThreshold
  return typeof threshold === 'number' && Number.isFinite(threshold)
    ? threshold
    : MCA_DEFAULT_RENEWAL_PAID_IN_THRESHOLD
}

export async function listRenewalSweepScopes(em: EntityManager): Promise<RenewalSweepScope[]> {
  const [settings, fundings] = await Promise.all([
    em.find(McaWorkspaceSettings, { deletedAt: null }, { fields: ['tenantId', 'organizationId'] }),
    em.find(McaFunding, { deletedAt: null }, { fields: ['tenantId', 'organizationId'] }),
  ])
  const seen = new Set<string>()
  const scopes: RenewalSweepScope[] = []
  for (const row of [...settings, ...fundings]) {
    const key = `${row.tenantId}:${row.organizationId}`
    if (seen.has(key)) continue
    seen.add(key)
    scopes.push({ tenantId: row.tenantId, organizationId: row.organizationId })
  }
  return scopes
}

export async function runRenewalSweep(
  em: EntityManager,
  scope: RenewalSweepScope,
  options?: {
    now?: Date
    threshold?: number
    emit?: typeof emitMerchantAdvancesEvent
  },
): Promise<RenewalSweepResult> {
  const now = options?.now ?? new Date()
  const threshold = options?.threshold ?? await resolveRenewalThreshold(em, scope)
  const fundings = await em.find(McaFunding, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  })
  const dealIds = [...new Set(fundings.map((funding) => funding.dealId))]
  const deals = dealIds.length
    ? await em.find(McaDeal, {
        id: { $in: dealIds },
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      }, { fields: ['id', 'merchantCompanyId'] })
    : []
  const dealById = new Map(deals.map((deal) => [deal.id, deal]))
  const fundingIds = fundings.map((funding) => funding.id)
  const existingRenewals = fundingIds.length
    ? await em.find(McaRenewal, {
        fundingId: { $in: fundingIds },
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      })
    : []
  const result = applyRenewalSweep({
    fundings: fundings.map((funding) => toSweepFunding(funding, dealById.get(funding.dealId)?.merchantCompanyId)),
    renewals: existingRenewals.map(toSweepRenewal),
  }, { scope, threshold, now })

  const fundingById = new Map(fundings.map((funding) => [funding.id, funding]))
  for (const planned of result.fundings) {
    const funding = fundingById.get(planned.id)
    if (funding && planned.paidInPct != null) funding.paidInPct = planned.paidInPct
  }

  const renewalById = new Map(existingRenewals.map((renewal) => [renewal.id, renewal]))
  const createdEntities = new Map<string, McaRenewal>()
  for (const planned of result.created) {
    const entity = em.create(McaRenewal, {
      id: planned.id,
      tenantId: planned.tenantId,
      organizationId: planned.organizationId,
      fundingId: planned.fundingId,
      dealId: planned.dealId,
      merchantCompanyId: planned.merchantCompanyId ?? null,
      paidInPct: planned.paidInPct ?? null,
      surfacedAt: planned.surfacedAt ?? now,
      status: planned.status,
    })
    em.persist(entity)
    createdEntities.set(planned.id, entity)
  }
  for (const planned of result.updated) {
    const entity = renewalById.get(planned.id)
    if (!entity) continue
    entity.paidInPct = planned.paidInPct ?? entity.paidInPct
    entity.status = planned.status
    entity.surfacedAt = planned.surfacedAt ?? entity.surfacedAt
    entity.merchantCompanyId = planned.merchantCompanyId ?? entity.merchantCompanyId
  }

  await em.flush()

  const emit = options?.emit ?? emitMerchantAdvancesEvent
  for (const planned of result.surfaced) {
    const entity = createdEntities.get(planned.id) ?? renewalById.get(planned.id)
    await emit('merchant_advances.renewal.surfaced', {
      id: entity?.id ?? planned.id,
      fundingId: planned.fundingId,
      dealId: planned.dealId,
      merchantCompanyId: planned.merchantCompanyId ?? null,
      paidInPct: planned.paidInPct ?? null,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    }, { persistent: true, tenantId: scope.tenantId, organizationId: scope.organizationId })
  }

  return result
}
