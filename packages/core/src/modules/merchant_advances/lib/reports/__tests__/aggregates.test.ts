import { hasFeature } from '@open-mercato/shared/security/features'
import { aggregateFunders, aggregateLeads, aggregateReps, aggregateTeam, REPORTS_VIEW_FEATURE } from '../aggregates'
import { buildReportDemoFixture } from '../demoFixture'
import { stripSsnShapedValues, toCsv } from '../ssn'

describe('merchant_advances report aggregates', () => {
  const snapshot = buildReportDemoFixture()

  it('builds non-zero rep, team, funder, and lead rows from the demo fixture', () => {
    const reps = aggregateReps(snapshot)
    expect(reps.some((row) => row.fundedAmount === '75000.00')).toBe(true)
    expect(reps.some((row) => row.distributions === '7500.00')).toBe(true)

    const team = aggregateTeam(snapshot)
    expect(team.distributions).toBe('7500.00')
    expect(team.stages.some((row) => row.stage === 'funded' && row.count === 1)).toBe(true)

    const funders = aggregateFunders(snapshot)
    expect(funders.some((row) => row.fundedAmount === '75000.00')).toBe(true)

    const leads = aggregateLeads(snapshot)
    expect(leads[0]?.deals).toBe(3)
    expect(leads[0]?.funded).toBe(1)
    expect(leads[0]?.avgCommission).toBe('7500.00')
  })

  it('strips SSN-shaped values from CSV exports', () => {
    const csv = toCsv(
      ['name', 'ssn'],
      [['Sunset Diner', '123-45-6789'], ['Owner', 'no-ssn']],
    )
    expect(csv).toContain('[redacted]')
    expect(csv).not.toContain('123-45-6789')
    expect(stripSsnShapedValues('tax 123-45-6789 file')).toBe('tax [redacted] file')
  })

  it('denies manager/rep feature sets that omit reports.view', () => {
    expect(hasFeature(['merchant_advances.*'], REPORTS_VIEW_FEATURE)).toBe(true)
    expect(hasFeature([
      'merchant_advances.deal.view',
      'merchant_advances.deal.manage',
      'merchant_advances.submission.send',
    ], REPORTS_VIEW_FEATURE)).toBe(false)
  })
})
