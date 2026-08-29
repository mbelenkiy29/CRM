import { MCA_WEEKDAYS_PER_MONTH } from '../../data/constants'
import { periodCount } from '../money'
import { calculatePaidInPct, isApproachingRenewal } from '../paidIn'

describe('merchant_advances paid-in helpers', () => {
  it('returns 0 before funding starts', () => {
    const fundedAt = new Date('2026-08-01T00:00:00.000Z')
    expect(calculatePaidInPct({
      fundedAt,
      frequency: 'daily',
      termMonths: 6,
      now: new Date('2026-07-01T00:00:00.000Z'),
    })).toBe(0)
  })

  it('surfaces renewals near 80% paid in after five of six months', () => {
    const fundedAt = new Date('2026-01-01T00:00:00.000Z')
    const now = new Date('2026-06-01T00:00:00.000Z')
    const pct = calculatePaidInPct({ fundedAt, frequency: 'monthly', termMonths: 6, now })
    expect(pct).toBeGreaterThanOrEqual(80)
    expect(isApproachingRenewal(pct)).toBe(true)
  })

  it('counts daily terms with 21 weekdays per month, not calendar days', () => {
    expect(MCA_WEEKDAYS_PER_MONTH).toBe(21)
    expect(periodCount(6, 'daily')).toBe(126)
  })

  it('reaches about 83% after five of six months of daily weekday periods', () => {
    const fundedAt = new Date('2026-01-01T00:00:00.000Z')
    const now = new Date('2026-04-16T00:00:00.000Z')
    const pct = calculatePaidInPct({ fundedAt, frequency: 'daily', termMonths: 6, now })
    expect(pct).toBe(83.33)
    expect(isApproachingRenewal(pct)).toBe(true)
    expect(isApproachingRenewal(79.99)).toBe(false)
  })
})
