import { formatMetricCount, formatMetricMoney, type StatementMetrics } from './extractStatement'

export type FillableDealFields = {
  avgMonthlyRevenue?: string | number | null
  position?: number | null
}

export type DealFieldFill = {
  avgMonthlyRevenue?: string
  position?: number
}

function isEmptyMoney(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'number') return !Number.isFinite(value)
  return value.trim().length === 0
}

function isEmptyCount(value: number | null | undefined): boolean {
  return value === null || value === undefined
}

export function resolveDealFieldFill(deal: FillableDealFields, extracted: StatementMetrics): DealFieldFill {
  const fill: DealFieldFill = {}
  const revenue = formatMetricMoney(extracted.avgMonthlyRevenue)
  if (isEmptyMoney(deal.avgMonthlyRevenue) && revenue) {
    fill.avgMonthlyRevenue = revenue
  }
  const position = formatMetricCount(extracted.existingPositions)
  if (isEmptyCount(deal.position) && position && position > 0) {
    fill.position = position
  }
  return fill
}

export type CombinedUnderwritingBox = {
  avgMonthlyRevenue: string | null
  avgDailyBalance: string | null
  depositCount: number | null
  nsfCount: number | null
  negativeDays: number | null
  existingPositions: number | null
  industry: string | null
  timeInBusinessMonths: number | null
  position: number | null
  state: string | null
  requestedAmount: string | null
  humanReviewRequired: true
  autoSubmit: false
}

export type CombineDealAttributesInput = {
  avgMonthlyRevenue?: string | number | null
  avgDailyBalance?: string | number | null
  depositCount?: number | null
  nsfCount?: number | null
  negativeDays?: number | null
  existingPositions?: number | null
  industry?: string | null
  timeInBusinessMonths?: number | null
  position?: number | null
  state?: string | null
  requestedAmount?: string | number | null
}

function moneyOrNull(value: string | number | null | undefined, fallback: number | null): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return formatMetricMoney(fallback)
}

function countOrNull(value: number | null | undefined, fallback: number | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return formatMetricCount(fallback)
}

export function combineDealAttributes(
  deal: CombineDealAttributesInput,
  extracted: StatementMetrics,
): CombinedUnderwritingBox {
  return {
    avgMonthlyRevenue: moneyOrNull(deal.avgMonthlyRevenue, extracted.avgMonthlyRevenue),
    avgDailyBalance: moneyOrNull(deal.avgDailyBalance, extracted.avgDailyBalance),
    depositCount: countOrNull(deal.depositCount, extracted.depositCount),
    nsfCount: countOrNull(deal.nsfCount, extracted.nsfCount),
    negativeDays: countOrNull(deal.negativeDays, extracted.negativeDays),
    existingPositions: countOrNull(deal.existingPositions ?? deal.position, extracted.existingPositions),
    industry: deal.industry?.trim() || null,
    timeInBusinessMonths: deal.timeInBusinessMonths ?? null,
    position: deal.position ?? formatMetricCount(extracted.existingPositions),
    state: deal.state?.trim() || null,
    requestedAmount: moneyOrNull(deal.requestedAmount, null),
    humanReviewRequired: true,
    autoSubmit: false,
  }
}
