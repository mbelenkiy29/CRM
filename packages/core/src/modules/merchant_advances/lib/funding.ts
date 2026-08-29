import type { McaPaymentFrequency } from '../data/constants'
import { calculateCommission, calculatePayback, calculatePayment, splitCommissionAmounts } from './money'

export const MCA_DEFAULT_OWNER_SPLIT_ROLE = 'owner'
export const MCA_DEFAULT_COMMISSION_CURRENCY = 'USD'

export const FUNDING_SPLIT_POINTS_MISMATCH = '[internal] commission split points must equal parent points'
export const FUNDING_MISSING_TERMS = '[internal] offer is missing amount, factor, or term months'

export type FundingSplitInput = {
  userId?: string | null
  role?: string | null
  points: string | number
}

export type FundingOfferInput = {
  amount: string | number | null | undefined
  factor: string | number | null | undefined
  termMonths: number | null | undefined
  paymentFrequency?: McaPaymentFrequency | null
  commissionPoints?: string | number | null
  ownerUserId?: string | null
}

export type FundingSplitResult = {
  userId: string | null
  role: string | null
  points: string
  amount: string
}

export type FundingComputation = {
  fundedAmount: string
  paybackAmount: string
  paymentAmount: string
  paymentFrequency: McaPaymentFrequency
  termMonths: number
  commissionPoints: string
  commissionAmount: string
  splits: FundingSplitResult[]
}

export function toPointsUnits(value: string | number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('[internal] invalid commission points')
  }
  return Math.round(numeric * 10000)
}

export function pointsToString(value: string | number): string {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('[internal] invalid commission points')
  }
  return String(numeric)
}

export function splitPointsMatchParent(parentPoints: string | number, splits: FundingSplitInput[]): boolean {
  if (!splits.length) return true
  const parentUnits = toPointsUnits(parentPoints)
  const splitUnits = splits.reduce((sum, split) => sum + toPointsUnits(split.points), 0)
  return splitUnits === parentUnits
}

function requirePositiveMoney(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined || value === '') {
    throw new Error(FUNDING_MISSING_TERMS)
  }
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(FUNDING_MISSING_TERMS)
  }
  return value
}

function resolveSplits(input: {
  parentPoints: string
  commissionAmount: string
  ownerUserId?: string | null
  splits?: FundingSplitInput[] | null
}): FundingSplitResult[] {
  const custom = (input.splits ?? []).filter((split) => split != null)
  const source: FundingSplitInput[] = custom.length
    ? custom
    : [{
        userId: input.ownerUserId ?? null,
        role: MCA_DEFAULT_OWNER_SPLIT_ROLE,
        points: input.parentPoints,
      }]

  if (!splitPointsMatchParent(input.parentPoints, source)) {
    throw new Error(FUNDING_SPLIT_POINTS_MISMATCH)
  }

  const parentUnits = toPointsUnits(input.parentPoints)
  if (parentUnits === 0) {
    return source.map((split) => ({
      userId: split.userId ?? null,
      role: split.role ?? null,
      points: pointsToString(split.points),
      amount: '0.00',
    }))
  }

  const amounts = splitCommissionAmounts(
    input.commissionAmount,
    source.map((split) => toPointsUnits(split.points)),
  )
  return source.map((split, index) => ({
    userId: split.userId ?? null,
    role: split.role ?? null,
    points: pointsToString(split.points),
    amount: amounts[index] ?? '0.00',
  }))
}

export function createFundingFromOffer(
  offer: FundingOfferInput,
  options?: {
    fundedAmount?: string | number | null
    splits?: FundingSplitInput[] | null
  },
): FundingComputation {
  const amount = requirePositiveMoney(options?.fundedAmount ?? offer.amount)
  const factor = requirePositiveMoney(offer.factor)
  const termMonths = offer.termMonths
  if (!Number.isInteger(termMonths) || !termMonths || termMonths <= 0) {
    throw new Error(FUNDING_MISSING_TERMS)
  }

  const paymentFrequency: McaPaymentFrequency = offer.paymentFrequency ?? 'daily'
  const fundedAmount = calculatePayback(amount, 1)
  const paybackAmount = calculatePayback(amount, factor)
  const paymentAmount = calculatePayment(paybackAmount, termMonths, paymentFrequency)
  const commissionPoints = offer.commissionPoints == null || offer.commissionPoints === ''
    ? '0'
    : pointsToString(offer.commissionPoints)
  const commissionAmount = calculateCommission(fundedAmount, commissionPoints)

  return {
    fundedAmount,
    paybackAmount,
    paymentAmount,
    paymentFrequency,
    termMonths,
    commissionPoints,
    commissionAmount,
    splits: resolveSplits({
      parentPoints: commissionPoints,
      commissionAmount,
      ownerUserId: offer.ownerUserId,
      splits: options?.splits,
    }),
  }
}
