import type { EntityManager } from '@mikro-orm/postgresql'
import type { McaRenewalStatus } from '../data/constants'
import { McaDeal, McaFunding, McaRenewal } from '../data/entities'
import {
  applyRenewalSweep,
  isMcaPaymentFrequency,
  listPastApprovalDeals,
  remainingTermDays,
  resolveRenewalThreshold,
  type RenewalSweepScope,
  type SweepDealRecord,
  type SweepFundingRecord,
  type SweepRenewalRecord,
} from './renewalSweep'

export type RenewalListItem = {
  id: string
  dealId: string
  fundingId: string
  merchantCompanyId: string | null
  merchantName: string | null
  paidInPct: string | null
  remainingDays: number | null
  status: McaRenewalStatus
  fundedAt: string | null
  termMonths: number | null
  paymentFrequency: string | null
  surfacedAt: string | null
  updatedAt: string | null
}

export type PastApprovalListItem = {
  dealId: string
  fundingId: string | null
  merchantCompanyId: string | null
  merchantName: string | null
  paidInPct: string | null
  fundedAt: string | null
  pipelineStatus: string
  updatedAt: string | null
}

export type RenewalQueueResult = {
  items: RenewalListItem[]
  pastApproval: PastApprovalListItem[]
  total: number
  pastApprovalTotal: number
  page: number
  pageSize: number
  totalPages: number
  threshold: number
}

function toIso(value: Date | null | undefined): string | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null
}

function merchantName(deal: SweepDealRecord | undefined): string | null {
  if (!deal) return null
  return deal.merchantNameSnapshot ?? deal.businessName ?? null
}

function toDealRecord(deal: {
  id: string
  tenantId: string
  organizationId: string
  merchantCompanyId?: string | null
  pipelineStatus: SweepDealRecord['pipelineStatus']
  businessName: string
  merchantNameSnapshot?: string | null
  updatedAt: Date
}): SweepDealRecord {
  return {
    id: deal.id,
    tenantId: deal.tenantId,
    organizationId: deal.organizationId,
    merchantCompanyId: deal.merchantCompanyId ?? null,
    pipelineStatus: deal.pipelineStatus,
    businessName: deal.businessName,
    merchantNameSnapshot: deal.merchantNameSnapshot ?? null,
    updatedAt: deal.updatedAt,
  }
}

function toFundingRecord(funding: McaFunding, merchantCompanyId?: string | null): SweepFundingRecord {
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

function toRenewalRecord(renewal: McaRenewal): SweepRenewalRecord {
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

function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize
  return rows.slice(start, start + pageSize)
}

export async function loadRenewalQueue(
  em: EntityManager,
  scope: RenewalSweepScope,
  query: {
    page: number
    pageSize: number
    status?: McaRenewalStatus
    now?: Date
  },
): Promise<RenewalQueueResult> {
  const now = query.now ?? new Date()
  const threshold = await resolveRenewalThreshold(em, scope)
  const [fundings, deals, renewals] = await Promise.all([
    em.find(McaFunding, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    }),
    em.find(McaDeal, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    }, {
      fields: ['id', 'tenantId', 'organizationId', 'merchantCompanyId', 'pipelineStatus', 'businessName', 'merchantNameSnapshot', 'updatedAt'],
    }),
    em.find(McaRenewal, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    }),
  ])

  const dealRecords = deals.map(toDealRecord)
  const dealById = new Map(dealRecords.map((deal) => [deal.id, deal]))
  const planned = applyRenewalSweep({
    fundings: fundings.map((funding) => toFundingRecord(funding, dealById.get(funding.dealId)?.merchantCompanyId)),
    renewals: renewals.map(toRenewalRecord),
    deals: dealRecords,
  }, { scope, threshold, now, nextId: (fundingId) => fundingId })

  const fundingById = new Map(planned.fundings.map((funding) => [funding.id, funding]))
  const items = planned.renewals
    .filter((row) => row.status !== 'watching')
    .filter((row) => !query.status || row.status === query.status)
    .map((row) => {
      const funding = fundingById.get(row.fundingId)
      const deal = dealById.get(row.dealId)
      const remaining = funding && isMcaPaymentFrequency(funding.paymentFrequency) && funding.termMonths
        ? remainingTermDays({
            fundedAt: funding.fundedAt,
            frequency: funding.paymentFrequency,
            termMonths: funding.termMonths,
            now,
          })
        : null
      return {
        id: row.id,
        dealId: row.dealId,
        fundingId: row.fundingId,
        merchantCompanyId: row.merchantCompanyId ?? deal?.merchantCompanyId ?? null,
        merchantName: merchantName(deal),
        paidInPct: row.paidInPct ?? funding?.paidInPct ?? null,
        remainingDays: remaining,
        status: row.status,
        fundedAt: toIso(funding?.fundedAt),
        termMonths: funding?.termMonths ?? null,
        paymentFrequency: funding?.paymentFrequency ?? null,
        surfacedAt: toIso(row.surfacedAt),
        updatedAt: toIso(deal?.updatedAt),
      } satisfies RenewalListItem
    })
    .sort((left, right) => Number(right.paidInPct ?? 0) - Number(left.paidInPct ?? 0))

  const latestFundingByDeal = new Map<string, SweepFundingRecord>()
  for (const funding of planned.fundings) {
    const current = latestFundingByDeal.get(funding.dealId)
    if (!current || funding.fundedAt.getTime() > current.fundedAt.getTime()) {
      latestFundingByDeal.set(funding.dealId, funding)
    }
  }

  const pastApproval = listPastApprovalDeals(dealRecords, scope).map((deal) => {
    const funding = latestFundingByDeal.get(deal.id)
    return {
      dealId: deal.id,
      fundingId: funding?.id ?? null,
      merchantCompanyId: deal.merchantCompanyId ?? null,
      merchantName: merchantName(deal),
      paidInPct: funding?.paidInPct ?? null,
      fundedAt: toIso(funding?.fundedAt),
      pipelineStatus: deal.pipelineStatus,
      updatedAt: toIso(deal.updatedAt),
    } satisfies PastApprovalListItem
  })

  return {
    items: paginate(items, query.page, query.pageSize),
    pastApproval: paginate(pastApproval, 1, query.pageSize),
    total: items.length,
    pastApprovalTotal: pastApproval.length,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(items.length / query.pageSize)),
    threshold,
  }
}
