import { fromCents, ratio, toCents } from './moneyAgg'

export type ReportDeal = {
  id: string
  ownerUserId: string | null
  pipelineStatus: string
  requestedAmount: string | null
  leadSourceId: string | null
  leadBatchId: string | null
}

export type ReportFunding = {
  dealId: string
  fundedAmount: string
  paymentAmount: string | null
}

export type ReportCommission = {
  dealId: string
  amount: string | null
}

export type ReportSplit = {
  userId: string | null
  amount: string | null
}

export type ReportSubmission = {
  dealId: string
  funderId: string
  status: string
}

export type ReportOffer = {
  dealId: string
  funderId: string | null
  status: string
}

export type ReportLeadSource = {
  id: string
  name: string
  costAmount: string | null
}

export type ReportLeadBatch = {
  id: string
  name: string
  leadSourceId: string | null
  costAmount: string | null
  leadCount: number | null
}

export type ReportSnapshot = {
  deals: ReportDeal[]
  fundings: ReportFunding[]
  commissions: ReportCommission[]
  splits: ReportSplit[]
  submissions: ReportSubmission[]
  offers: ReportOffer[]
  leadSources: ReportLeadSource[]
  leadBatches: ReportLeadBatch[]
}

const SUBMITTED_PLUS = new Set(['submitted', 'offered', 'contracted', 'funded'])
const APPROVED_PLUS = new Set(['offered', 'contracted', 'funded'])

export function aggregateReps(snapshot: ReportSnapshot): Array<{
  ownerUserId: string
  dealsIn: number
  submitted: number
  approved: number
  funded: number
  fundedAmount: string
  distributions: string
  conversionPct: string
}> {
  const fundedByDeal = new Map(snapshot.fundings.map((row) => [row.dealId, row]))
  const byOwner = new Map<string, ReturnType<typeof aggregateReps>[number] & { fundedCents: number; distCents: number }>()
  for (const deal of snapshot.deals) {
    const owner = deal.ownerUserId ?? 'unassigned'
    const current = byOwner.get(owner) ?? {
      ownerUserId: owner,
      dealsIn: 0,
      submitted: 0,
      approved: 0,
      funded: 0,
      fundedAmount: '0.00',
      distributions: '0.00',
      conversionPct: '0.00',
      fundedCents: 0,
      distCents: 0,
    }
    current.dealsIn += 1
    if (SUBMITTED_PLUS.has(deal.pipelineStatus)) current.submitted += 1
    if (APPROVED_PLUS.has(deal.pipelineStatus)) current.approved += 1
    const funding = fundedByDeal.get(deal.id)
    if (funding || deal.pipelineStatus === 'funded') {
      current.funded += 1
      current.fundedCents += toCents(funding?.fundedAmount)
    }
    byOwner.set(owner, current)
  }
  for (const split of snapshot.splits) {
    const owner = split.userId ?? 'unassigned'
    const current = byOwner.get(owner)
    if (!current) continue
    current.distCents += toCents(split.amount)
  }
  return [...byOwner.values()].map((row) => ({
    ownerUserId: row.ownerUserId,
    dealsIn: row.dealsIn,
    submitted: row.submitted,
    approved: row.approved,
    funded: row.funded,
    fundedAmount: fromCents(row.fundedCents),
    distributions: fromCents(row.distCents),
    conversionPct: ratio(row.funded, row.dealsIn),
  }))
}

export function aggregateTeam(snapshot: ReportSnapshot): {
  stages: Array<{ stage: string; count: number }>
  payments: string
  distributions: string
  profitByUser: Array<{ ownerUserId: string; profit: string }>
} {
  const stages = new Map<string, number>()
  for (const deal of snapshot.deals) {
    stages.set(deal.pipelineStatus, (stages.get(deal.pipelineStatus) ?? 0) + 1)
  }
  const payments = fromCents(snapshot.fundings.reduce((sum, row) => sum + toCents(row.paymentAmount), 0))
  const distributions = fromCents(snapshot.commissions.reduce((sum, row) => sum + toCents(row.amount), 0))
  const profitMap = new Map<string, number>()
  for (const split of snapshot.splits) {
    const owner = split.userId ?? 'unassigned'
    profitMap.set(owner, (profitMap.get(owner) ?? 0) + toCents(split.amount))
  }
  return {
    stages: [...stages.entries()].map(([stage, count]) => ({ stage, count })),
    payments,
    distributions,
    profitByUser: [...profitMap.entries()].map(([ownerUserId, cents]) => ({
      ownerUserId,
      profit: fromCents(cents),
    })),
  }
}

export function aggregateFunders(snapshot: ReportSnapshot): Array<{
  funderId: string
  submitted: number
  approved: number
  funded: number
  fundedAmount: string
  commissions: string
}> {
  const fundedDeals = new Set(snapshot.fundings.map((row) => row.dealId))
  const fundedAmountByDeal = new Map(snapshot.fundings.map((row) => [row.dealId, toCents(row.fundedAmount)]))
  const commissionByDeal = new Map<string, number>()
  for (const row of snapshot.commissions) {
    commissionByDeal.set(row.dealId, (commissionByDeal.get(row.dealId) ?? 0) + toCents(row.amount))
  }
  const byFunder = new Map<string, {
    funderId: string
    submitted: number
    approved: number
    funded: number
    fundedCents: number
    commissionCents: number
  }>()
  for (const submission of snapshot.submissions) {
    const current = byFunder.get(submission.funderId) ?? {
      funderId: submission.funderId,
      submitted: 0,
      approved: 0,
      funded: 0,
      fundedCents: 0,
      commissionCents: 0,
    }
    current.submitted += 1
    if (['accepted', 'offered', 'stips'].includes(submission.status)) current.approved += 1
    if (fundedDeals.has(submission.dealId) || submission.status === 'accepted') {
      current.funded += 1
      current.fundedCents += fundedAmountByDeal.get(submission.dealId) ?? 0
      current.commissionCents += commissionByDeal.get(submission.dealId) ?? 0
    }
    byFunder.set(submission.funderId, current)
  }
  for (const offer of snapshot.offers) {
    if (!offer.funderId) continue
    const current = byFunder.get(offer.funderId) ?? {
      funderId: offer.funderId,
      submitted: 0,
      approved: 0,
      funded: 0,
      fundedCents: 0,
      commissionCents: 0,
    }
    current.approved += 1
    byFunder.set(offer.funderId, current)
  }
  return [...byFunder.values()].map((row) => ({
    funderId: row.funderId,
    submitted: row.submitted,
    approved: row.approved,
    funded: row.funded,
    fundedAmount: fromCents(row.fundedCents),
    commissions: fromCents(row.commissionCents),
  }))
}

export function aggregateLeads(snapshot: ReportSnapshot): Array<{
  key: string
  name: string
  deals: number
  funded: number
  conversionPct: string
  avgCommission: string
  cac: string
  roi: string
  costPerFunded: string
}> {
  const fundedDeals = new Set(snapshot.fundings.map((row) => row.dealId))
  const commissionByDeal = new Map<string, number>()
  for (const row of snapshot.commissions) {
    commissionByDeal.set(row.dealId, (commissionByDeal.get(row.dealId) ?? 0) + toCents(row.amount))
  }
  const groups = new Map<string, {
    key: string
    name: string
    deals: number
    funded: number
    commissionCents: number
    costCents: number
  }>()
  const sourceCost = new Map(snapshot.leadSources.map((row) => [row.id, toCents(row.costAmount)]))
  const batchCost = new Map(snapshot.leadBatches.map((row) => [row.id, toCents(row.costAmount)]))
  const sourceName = new Map(snapshot.leadSources.map((row) => [row.id, row.name]))
  const batchName = new Map(snapshot.leadBatches.map((row) => [row.id, row.name]))

  for (const deal of snapshot.deals) {
    const key = deal.leadBatchId
      ? `batch:${deal.leadBatchId}`
      : deal.leadSourceId
        ? `source:${deal.leadSourceId}`
        : 'source:unassigned'
    const name = deal.leadBatchId
      ? (batchName.get(deal.leadBatchId) ?? 'Batch')
      : (sourceName.get(deal.leadSourceId ?? '') ?? 'Unassigned')
    const current = groups.get(key) ?? {
      key,
      name,
      deals: 0,
      funded: 0,
      commissionCents: 0,
      costCents: sourceCost.get(deal.leadSourceId ?? '') ?? batchCost.get(deal.leadBatchId ?? '') ?? 0,
    }
    current.deals += 1
    if (fundedDeals.has(deal.id) || deal.pipelineStatus === 'funded') {
      current.funded += 1
      current.commissionCents += commissionByDeal.get(deal.id) ?? 0
    }
    groups.set(key, current)
  }
  return [...groups.values()].map((row) => ({
    key: row.key,
    name: row.name,
    deals: row.deals,
    funded: row.funded,
    conversionPct: ratio(row.funded, row.deals),
    avgCommission: fromCents(row.funded ? Math.round(row.commissionCents / row.funded) : 0),
    cac: fromCents(row.deals ? Math.round(row.costCents / row.deals) : 0),
    roi: ratio(row.commissionCents, row.costCents),
    costPerFunded: fromCents(row.funded ? Math.round(row.costCents / row.funded) : 0),
  }))
}

export const REPORTS_VIEW_FEATURE = 'merchant_advances.reports.view'
