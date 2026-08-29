import { scoreFunder } from '../funderScore'

describe('merchant_advances funder score', () => {
  it('ranks a strong industry and first-position fit above a weak match', () => {
    const deal = {
      industry: 'Auto repair',
      state: 'TX',
      avgMonthlyRevenue: '142000',
      timeInBusinessMonths: 36,
      position: 1,
      requestedAmount: '75000',
      nsfCount: 0,
      negativeDays: 0,
      existingPositions: 0,
      depositCount: 40,
      avgDailyBalance: '18000',
    }
    const best = scoreFunder(deal, {
      industries: ['auto repair'],
      states: ['TX'],
      minAvgMonthlyRevenue: 50000,
      minTimeInBusinessMonths: 12,
      maxPosition: 1,
      maxRequestedAmount: 150000,
    })
    const weaker = scoreFunder(deal, {
      industries: ['restaurants'],
      states: ['NY'],
      minAvgMonthlyRevenue: 200000,
      maxPosition: 1,
    })
    expect(best.score).toBeGreaterThan(weaker.score)
    expect(best.reasons.some((reason) => reason.code === 'industry' && reason.passed)).toBe(true)
    expect(best.reasons.some((reason) => reason.code === 'position' && reason.passed)).toBe(true)
  })
})
