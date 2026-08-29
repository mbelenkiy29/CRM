import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { combineDealAttributes, resolveDealFieldFill } from '../applyDealFill'
import { extractStatementMetrics, parseMoneyToken } from '../extractStatement'

function readFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8')
}

describe('extractStatementMetrics', () => {
  it('extracts labeled OCR metrics from fixture text', () => {
    const metrics = extractStatementMetrics(readFixture('labeled-statement.md'))
    expect(metrics).toEqual({
      avgMonthlyRevenue: 62450,
      avgDailyBalance: 14220.5,
      depositCount: 47,
      nsfCount: 2,
      negativeDays: 3,
      existingPositions: 1,
    })
  })

  it('averages deposit and balance columns from a markdown table', () => {
    const metrics = extractStatementMetrics(readFixture('table-statement.md'))
    expect(metrics.avgMonthlyRevenue).toBeCloseTo(62450, 5)
    expect(metrics.avgDailyBalance).toBeCloseTo(13516.6666, 3)
    expect(metrics.depositCount).toBe(49)
    expect(metrics.nsfCount).toBe(1)
    expect(metrics.negativeDays).toBe(3)
    expect(metrics.existingPositions).toBe(1)
  })

  it('parses messy OCR tokens and ordinal positions', () => {
    const metrics = extractStatementMetrics(readFixture('ocr-statement.txt'))
    expect(metrics.avgMonthlyRevenue).toBeCloseTo(41112.19, 5)
    expect(metrics.avgDailyBalance).toBe(8200)
    expect(metrics.depositCount).toBe(12)
    expect(metrics.nsfCount).toBe(0)
    expect(metrics.negativeDays).toBe(0)
    expect(metrics.existingPositions).toBe(2)
  })

  it('returns nulls for empty or unrelated text', () => {
    expect(extractStatementMetrics('')).toEqual({
      avgMonthlyRevenue: null,
      avgDailyBalance: null,
      depositCount: null,
      nsfCount: null,
      negativeDays: null,
      existingPositions: null,
    })
    expect(extractStatementMetrics('Thank you for banking with us.').avgMonthlyRevenue).toBeNull()
  })

  it('treats parenthetical amounts as negative money', () => {
    expect(parseMoneyToken('($1,234.50)')).toBe(-1234.5)
    expect(parseMoneyToken('USD 9,000.00')).toBe(9000)
  })

  it('prefers explicit labels over table averages when both exist', () => {
    const markdown = `${readFixture('table-statement.md')}\n\nAverage Monthly Revenue: $70,000.00\n`
    expect(extractStatementMetrics(markdown).avgMonthlyRevenue).toBe(70000)
  })
})

describe('resolveDealFieldFill', () => {
  const extracted = {
    avgMonthlyRevenue: 50000,
    avgDailyBalance: 9000,
    depositCount: 20,
    nsfCount: 0,
    negativeDays: 1,
    existingPositions: 2,
  }

  it('fills empty deal AMR and position from the statement', () => {
    expect(resolveDealFieldFill({ avgMonthlyRevenue: null, position: null }, extracted)).toEqual({
      avgMonthlyRevenue: '50000.00',
      position: 2,
    })
  })

  it('does not overwrite sheet or deal values', () => {
    expect(resolveDealFieldFill({ avgMonthlyRevenue: '88000.00', position: 1 }, extracted)).toEqual({})
  })
})

describe('combineDealAttributes', () => {
  it('lets deal/sheet values win and never auto-submits', () => {
    const box = combineDealAttributes(
      {
        avgMonthlyRevenue: '88000',
        industry: 'auto repair',
        timeInBusinessMonths: 36,
        position: 1,
        state: 'TX',
        requestedAmount: '75000',
      },
      {
        avgMonthlyRevenue: 50000,
        avgDailyBalance: 12000,
        depositCount: 40,
        nsfCount: 2,
        negativeDays: 3,
        existingPositions: 2,
      },
    )
    expect(box.avgMonthlyRevenue).toBe('88000')
    expect(box.position).toBe(1)
    expect(box.avgDailyBalance).toBe('12000.00')
    expect(box.nsfCount).toBe(2)
    expect(box.humanReviewRequired).toBe(true)
    expect(box.autoSubmit).toBe(false)
  })
})
