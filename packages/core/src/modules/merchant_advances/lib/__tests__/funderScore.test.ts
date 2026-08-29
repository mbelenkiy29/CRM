import { FUNDER_CRITERIA_KEYS, scoreFunder } from '../funderScore'
import { HARBOR_ADVANCE_CRITERIA, NORTHSTAR_CAPITAL_CRITERIA } from '../seedFunders'

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

  it('exposes 20+ scorable appetite fields', () => {
    expect(FUNDER_CRITERIA_KEYS.length).toBeGreaterThanOrEqual(20)
  })

  it('scores every seeded Harbor criterion for a complete deal snapshot', () => {
    const result = scoreFunder({
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
      creditScore: 640,
      bankruptcy: false,
      useOfFunds: 'working capital',
      entityType: 'llc',
      sic: '7538',
      holdbackPct: 15,
      stacking: false,
      weekendDeposits: false,
      timeToFundDays: 5,
    }, HARBOR_ADVANCE_CRITERIA)
    expect(result.reasons.length).toBeGreaterThanOrEqual(20)
    expect(result.score).toBeGreaterThan(80)
    expect(result.reasons.every((reason) => reason.passed)).toBe(true)
  })

  it('ranks Harbor above Northstar when the deal is second position', () => {
    const deal = {
      industry: 'Auto repair',
      state: 'TX',
      avgMonthlyRevenue: '142000',
      timeInBusinessMonths: 36,
      position: 2,
      requestedAmount: '75000',
      nsfCount: 0,
      negativeDays: 0,
      existingPositions: 2,
      depositCount: 40,
      avgDailyBalance: '18000',
      creditScore: 640,
      bankruptcy: false,
      useOfFunds: 'working capital',
      entityType: 'llc',
      holdbackPct: 15,
      stacking: false,
      weekendDeposits: false,
      timeToFundDays: 5,
    }
    const harbor = scoreFunder(deal, HARBOR_ADVANCE_CRITERIA)
    const northstar = scoreFunder(deal, NORTHSTAR_CAPITAL_CRITERIA)
    expect(harbor.score).toBeGreaterThan(northstar.score)
    expect(harbor.reasons.some((reason) => reason.code === 'position' && reason.passed)).toBe(true)
    expect(northstar.reasons.some((reason) => reason.code === 'position' && !reason.passed)).toBe(true)
  })
})
