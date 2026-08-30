import { buildSunsetDinerIntakePayload, intakeFixtureHasRemoteUrls, stripRemoteStatementUrls } from '../fixture'

describe('merchant_advances onboarding intake fixture', () => {
  it('builds Sunset Diner without remote statement URLs', () => {
    const payload = buildSunsetDinerIntakePayload()
    expect(payload.businessName).toBe('Sunset Diner')
    expect(payload.industry).toBe('Auto repair')
    expect(payload.state).toBe('TX')
    expect(payload.avgMonthlyRevenue).toBe('142000')
    expect(payload.timeInBusinessMonths).toBe(36)
    expect(payload.position).toBe(1)
    expect(payload.requestedAmount).toBe('75000')
    expect(payload).not.toHaveProperty('statementUrls')
    expect(intakeFixtureHasRemoteUrls(payload)).toBe(false)
  })

  it('strips statement URLs so the fixture never fetches remote files', () => {
    const stripped = stripRemoteStatementUrls({
      ...buildSunsetDinerIntakePayload(),
      statementUrls: ['https://evil.example/stmt.pdf'],
    })
    expect(stripped).not.toHaveProperty('statementUrls')
    expect(intakeFixtureHasRemoteUrls(stripped)).toBe(false)
  })
})
