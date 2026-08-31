import { previewFunderCsv, readyFunderCsvRows, routeToSubmitMethod } from '../funderCsv'

const CSV = `name,code,route,contactEmail,fromAddress,requiresUnstampedStatements,states,ssn
Harbor Advance,harbor,email,uw@harbor.example,iso@shop.example,false,TX|FL,123-45-6789
,missing,email,uw@x.example,,,TX,111-22-3333
Northstar Capital,northstar,api,uw@northstar.example,,true,TX,
`

describe('merchant_advances onboarding funder CSV', () => {
  it('previews rows and never writes SSN-shaped values', () => {
    const preview = previewFunderCsv(CSV)
    expect(preview.readyCount).toBe(2)
    expect(preview.failedCount).toBe(1)
    expect(preview.rejectedSsnCount).toBe(2)
    const harbor = preview.rows.find((row) => row.name === 'Harbor Advance')
    expect(harbor?.rejectedCells).toContain('ssn')
    expect(JSON.stringify(harbor)).not.toMatch(/123-45-6789/)
    expect(readyFunderCsvRows(preview).map((row) => row.name)).toEqual([
      'Harbor Advance',
      'Northstar Capital',
    ])
  })

  it('maps api routes to deferred submit methods', () => {
    const preview = previewFunderCsv(CSV)
    const northstar = preview.rows.find((row) => row.code === 'northstar')
    expect(northstar?.route).toBe('api_deferred')
    expect(routeToSubmitMethod('api_deferred')).toBe('api')
  })
})
