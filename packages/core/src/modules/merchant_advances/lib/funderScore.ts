export type ScoreableDeal = {
  industry?: string | null
  state?: string | null
  avgMonthlyRevenue?: string | number | null
  timeInBusinessMonths?: number | null
  position?: number | null
  requestedAmount?: string | number | null
  nsfCount?: number | null
  negativeDays?: number | null
  existingPositions?: number | null
  depositCount?: number | null
  avgDailyBalance?: string | number | null
  creditScore?: number | null
  bankruptcy?: boolean | null
  useOfFunds?: string | null
  entityType?: string | null
  sic?: string | null
  holdbackPct?: number | null
  stacking?: boolean | null
  weekendDeposits?: boolean | null
  timeToFundDays?: number | null
}

export type FunderCriteria = {
  industries?: string[]
  excludedIndustries?: string[]
  states?: string[]
  minAvgMonthlyRevenue?: number
  maxAvgMonthlyRevenue?: number
  minTimeInBusinessMonths?: number
  maxPosition?: number
  minRequestedAmount?: number
  maxRequestedAmount?: number
  maxNsfCount?: number
  maxNegativeDays?: number
  maxExistingPositions?: number
  minDepositCount?: number
  minAvgDailyBalance?: number
  preferredIndustries?: string[]
  allowStacking?: boolean
  weekendDepositsOk?: boolean
  entityTypes?: string[]
  excludedSic?: string[]
  maxHoldbackPct?: number
  minCreditScore?: number
  bankruptcyOk?: boolean
  useOfFunds?: string[]
  maxTimeToFundDays?: number
}

export const FUNDER_CRITERIA_KEYS = [
  'industries',
  'excludedIndustries',
  'states',
  'minAvgMonthlyRevenue',
  'maxAvgMonthlyRevenue',
  'minTimeInBusinessMonths',
  'maxPosition',
  'minRequestedAmount',
  'maxRequestedAmount',
  'maxNsfCount',
  'maxNegativeDays',
  'maxExistingPositions',
  'minDepositCount',
  'minAvgDailyBalance',
  'preferredIndustries',
  'allowStacking',
  'weekendDepositsOk',
  'entityTypes',
  'excludedSic',
  'maxHoldbackPct',
  'minCreditScore',
  'bankruptcyOk',
  'useOfFunds',
  'maxTimeToFundDays',
] as const

export function parseFunderCriteria(value: unknown): FunderCriteria {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as FunderCriteria
}

export type FunderScoreReason = {
  code: string
  passed: boolean
  label: string
}

export type FunderScoreResult = {
  score: number
  reasons: FunderScoreReason[]
}

function asNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function pushReason(
  reasons: FunderScoreReason[],
  code: string,
  passed: boolean,
  label: string,
): void {
  reasons.push({ code, passed, label })
}

export function scoreFunder(deal: ScoreableDeal, criteria: FunderCriteria): FunderScoreResult {
  const reasons: FunderScoreReason[] = []
  let points = 0
  let possible = 0

  const check = (code: string, label: string, applicable: boolean, passed: boolean, weight = 1) => {
    if (!applicable) return
    possible += weight
    if (passed) points += weight
    pushReason(reasons, code, passed, label)
  }

  const industry = deal.industry?.trim().toLowerCase() ?? ''
  const industries = (criteria.industries ?? []).map((value) => value.toLowerCase())
  const excluded = (criteria.excludedIndustries ?? []).map((value) => value.toLowerCase())
  const preferred = (criteria.preferredIndustries ?? []).map((value) => value.toLowerCase())
  check('industry', 'Industry fit', industries.length > 0 || excluded.length > 0, {
    get passed() {
      if (industry && excluded.includes(industry)) return false
      if (industries.length === 0) return true
      return Boolean(industry && industries.includes(industry))
    },
  }.passed)

  if (industry && preferred.includes(industry)) {
    check('preferred_industry', 'Preferred industry', true, true)
  }

  const state = deal.state?.trim().toUpperCase() ?? ''
  const states = (criteria.states ?? []).map((value) => value.toUpperCase())
  check('state', 'State fit', states.length > 0, Boolean(state && states.includes(state)))

  const revenue = asNumber(deal.avgMonthlyRevenue)
  check(
    'min_revenue',
    'Minimum monthly revenue',
    criteria.minAvgMonthlyRevenue != null,
    revenue != null && criteria.minAvgMonthlyRevenue != null && revenue >= criteria.minAvgMonthlyRevenue,
  )
  check(
    'max_revenue',
    'Maximum monthly revenue',
    criteria.maxAvgMonthlyRevenue != null,
    revenue != null && criteria.maxAvgMonthlyRevenue != null && revenue <= criteria.maxAvgMonthlyRevenue,
  )

  check(
    'min_tib',
    'Time in business',
    criteria.minTimeInBusinessMonths != null,
    deal.timeInBusinessMonths != null &&
      criteria.minTimeInBusinessMonths != null &&
      deal.timeInBusinessMonths >= criteria.minTimeInBusinessMonths,
  )

  const maxPosition = criteria.maxPosition
  const positionOk = deal.position == null || maxPosition == null || deal.position <= maxPosition
  check('position', maxPosition === 1 ? '1st position OK' : 'Position cap', maxPosition != null, positionOk)

  const requested = asNumber(deal.requestedAmount)
  check(
    'min_requested',
    'Minimum requested amount',
    criteria.minRequestedAmount != null,
    requested != null && criteria.minRequestedAmount != null && requested >= criteria.minRequestedAmount,
  )
  check(
    'max_requested',
    'Maximum requested amount',
    criteria.maxRequestedAmount != null,
    requested != null && criteria.maxRequestedAmount != null && requested <= criteria.maxRequestedAmount,
  )

  check(
    'nsf',
    'NSF cap',
    criteria.maxNsfCount != null,
    deal.nsfCount != null && criteria.maxNsfCount != null && deal.nsfCount <= criteria.maxNsfCount,
  )
  check(
    'negative_days',
    'Negative days cap',
    criteria.maxNegativeDays != null,
    deal.negativeDays != null && criteria.maxNegativeDays != null && deal.negativeDays <= criteria.maxNegativeDays,
  )
  check(
    'existing_positions',
    'Existing positions cap',
    criteria.maxExistingPositions != null,
    deal.existingPositions != null &&
      criteria.maxExistingPositions != null &&
      deal.existingPositions <= criteria.maxExistingPositions,
  )
  check(
    'deposits',
    'Minimum deposits',
    criteria.minDepositCount != null,
    deal.depositCount != null && criteria.minDepositCount != null && deal.depositCount >= criteria.minDepositCount,
  )
  const adb = asNumber(deal.avgDailyBalance)
  check(
    'adb',
    'Average daily balance',
    criteria.minAvgDailyBalance != null,
    adb != null && criteria.minAvgDailyBalance != null && adb >= criteria.minAvgDailyBalance,
  )

  check(
    'stacking',
    'Stacking allowed',
    criteria.allowStacking === false,
    deal.stacking !== true,
  )
  check(
    'weekend_deposits',
    'Weekend deposits',
    criteria.weekendDepositsOk === false,
    deal.weekendDeposits !== true,
  )

  const entityType = deal.entityType?.trim().toLowerCase() ?? ''
  const entityTypes = (criteria.entityTypes ?? []).map((value) => value.toLowerCase())
  check('entity_type', 'Entity type', entityTypes.length > 0, Boolean(entityType && entityTypes.includes(entityType)))

  const sic = deal.sic?.trim() ?? ''
  const excludedSic = criteria.excludedSic ?? []
  check('sic', 'SIC exclusion', excludedSic.length > 0, !sic || !excludedSic.includes(sic))

  check(
    'holdback',
    'Holdback cap',
    criteria.maxHoldbackPct != null,
    deal.holdbackPct != null && criteria.maxHoldbackPct != null && deal.holdbackPct <= criteria.maxHoldbackPct,
  )
  check(
    'credit',
    'Minimum credit score',
    criteria.minCreditScore != null,
    deal.creditScore != null && criteria.minCreditScore != null && deal.creditScore >= criteria.minCreditScore,
  )
  check(
    'bankruptcy',
    'Bankruptcy policy',
    criteria.bankruptcyOk === false,
    deal.bankruptcy !== true,
  )

  const useOfFunds = deal.useOfFunds?.trim().toLowerCase() ?? ''
  const allowedUse = (criteria.useOfFunds ?? []).map((value) => value.toLowerCase())
  check('use_of_funds', 'Use of funds', allowedUse.length > 0, Boolean(useOfFunds && allowedUse.includes(useOfFunds)))

  check(
    'time_to_fund',
    'Time to fund',
    criteria.maxTimeToFundDays != null,
    deal.timeToFundDays != null &&
      criteria.maxTimeToFundDays != null &&
      deal.timeToFundDays <= criteria.maxTimeToFundDays,
  )

  if (possible === 0) {
    return { score: 0, reasons }
  }
  return { score: Math.round((points / possible) * 10000) / 100, reasons }
}
