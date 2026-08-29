import { detectHeaderRow, suggestColumnMap } from '../detectHeaders'

describe('detectHeaderRow', () => {
  it('skips a title row and picks the alias-rich header row', () => {
    const detected = detectHeaderRow([
      ['Q1 purchased leads'],
      ['Business Name', 'Requested Amount', 'State', 'SSN'],
      ['Acme LLC', '50000', 'TX', '123-45-6789'],
    ])
    expect(detected.index).toBe(1)
    expect(detected.headers).toEqual(['Business Name', 'Requested Amount', 'State', 'SSN'])
  })

  it('uses the first row when it already looks like headers', () => {
    const detected = detectHeaderRow([
      ['Company', 'Industry', 'EIN'],
      ['Harbor Auto', 'auto repair', '12-3456789'],
    ])
    expect(detected.index).toBe(0)
  })
})

describe('suggestColumnMap', () => {
  it('maps known aliases and leaves SSN unmapped as sensitive', () => {
    const result = suggestColumnMap(['Business Name', 'Amount Requested', 'Originator', 'SSN', 'Offer sent'])
    expect(result.map['Business Name']).toBe('businessName')
    expect(result.map['Amount Requested']).toBe('requestedAmount')
    expect(result.map.Originator).toBe('originator')
    expect(result.map.SSN).toBeNull()
    expect(result.sensitive).toEqual(['SSN'])
    expect(result.unmapped).toEqual(['Offer sent'])
  })

  it('uses an injected suggestFn for leftover headers without calling a live LLM', () => {
    const result = suggestColumnMap(['DBA', 'Mystery Column'], (headers) => {
      expect(headers).toEqual(['Mystery Column'])
      return { 'Mystery Column': 'industry' }
    })
    expect(result.map.DBA).toBe('businessName')
    expect(result.map['Mystery Column']).toBe('industry')
    expect(result.unmapped).toEqual([])
  })
})
