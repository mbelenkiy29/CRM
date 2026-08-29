import { MCA_WEEKDAYS_PER_MONTH, type McaPaymentFrequency } from '../data/constants'

function toCents(value: string | number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    throw new Error('[internal] invalid money value')
  }
  return Math.round(numeric * 100)
}

function fromCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function calculatePayback(amount: string | number, factor: string | number): string {
  const factorNumeric = typeof factor === 'number' ? factor : Number(factor)
  if (!Number.isFinite(factorNumeric) || factorNumeric <= 0) {
    throw new Error('[internal] invalid factor')
  }
  return fromCents(Math.round(toCents(amount) * factorNumeric))
}

export function periodCount(termMonths: number, frequency: McaPaymentFrequency): number {
  if (!Number.isInteger(termMonths) || termMonths <= 0) {
    throw new Error('[internal] invalid term months')
  }
  if (frequency === 'monthly') return termMonths
  if (frequency === 'weekly') return Math.round(termMonths * (52 / 12))
  return termMonths * MCA_WEEKDAYS_PER_MONTH
}

export function calculatePayment(
  payback: string | number,
  termMonths: number,
  frequency: McaPaymentFrequency,
): string {
  const periods = periodCount(termMonths, frequency)
  return fromCents(Math.round(toCents(payback) / periods))
}

export function calculateCommission(fundedAmount: string | number, points: string | number): string {
  const pointsNumeric = typeof points === 'number' ? points : Number(points)
  if (!Number.isFinite(pointsNumeric) || pointsNumeric < 0) {
    throw new Error('[internal] invalid commission points')
  }
  return fromCents(Math.round(toCents(fundedAmount) * (pointsNumeric / 100)))
}

export function splitCommissionAmounts(totalAmount: string | number, pointsParts: number[]): string[] {
  const totalPoints = pointsParts.reduce((sum, part) => sum + part, 0)
  if (totalPoints <= 0) {
    throw new Error('[internal] commission split points must be positive')
  }
  const totalCents = toCents(totalAmount)
  const raw = pointsParts.map((part) => Math.floor((totalCents * part) / totalPoints))
  const remainder = totalCents - raw.reduce((sum, part) => sum + part, 0)
  if (raw.length) raw[raw.length - 1] += remainder
  return raw.map(fromCents)
}
