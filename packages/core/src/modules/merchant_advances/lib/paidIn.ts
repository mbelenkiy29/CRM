import { periodCount } from './money'
import type { McaPaymentFrequency } from '../data/constants'

export function calculatePaidInPct(input: {
  fundedAt: Date
  frequency: McaPaymentFrequency
  termMonths: number
  now?: Date
}): number {
  const now = input.now ?? new Date()
  const elapsedMs = now.getTime() - input.fundedAt.getTime()
  if (elapsedMs <= 0) return 0
  const totalPeriods = periodCount(input.termMonths, input.frequency)
  let elapsedPeriods: number
  if (input.frequency === 'monthly') {
    elapsedPeriods = elapsedMs / (30.4375 * 24 * 60 * 60 * 1000)
  } else if (input.frequency === 'weekly') {
    elapsedPeriods = elapsedMs / (7 * 24 * 60 * 60 * 1000)
  } else {
    elapsedPeriods = elapsedMs / (24 * 60 * 60 * 1000)
  }
  const pct = (elapsedPeriods / totalPeriods) * 100
  return Math.max(0, Math.min(100, Math.round(pct * 100) / 100))
}

export function isApproachingRenewal(paidInPct: number, threshold = 80): boolean {
  return paidInPct >= threshold
}
