import { extractApplicationFields, fillMissingFieldsFromPdf } from '../fillFromApplicationPdf'

const SAMPLE_PDF = `
Merchant Application
Legal Name: Harbor Auto Repair LLC
EIN: 12-3456789
Legal Address: 100 Main Street, Austin, TX 78701
Requested Amount: $75,000
Average Monthly Revenue: 52000
Time in Business: 36 months
`

describe('extractApplicationFields', () => {
  it('extracts EIN, address, amounts, and business name', () => {
    const fields = extractApplicationFields(SAMPLE_PDF)
    expect(fields.businessName).toBe('Harbor Auto Repair LLC')
    expect(fields.ein).toBe('12-3456789')
    expect(fields.legalAddress).toMatch(/100 Main Street/)
    expect(fields.state).toBe('TX')
    expect(fields.requestedAmount).toBe('75,000')
    expect(fields.avgMonthlyRevenue).toBe('52000')
    expect(fields.timeInBusinessMonths).toBe(36)
  })
})

describe('fillMissingFieldsFromPdf', () => {
  it('fills blanks from the PDF and leaves sheet values in place', () => {
    const filled = fillMissingFieldsFromPdf(
      {
        businessName: 'Harbor Auto Repair LLC',
        requestedAmount: '80000',
        ein: null,
        legalAddress: null,
        avgMonthlyRevenue: null,
      },
      extractApplicationFields(SAMPLE_PDF),
    )
    expect(filled.fields.requestedAmount).toBe('80000')
    expect(filled.fields.ein).toBe('12-3456789')
    expect(filled.fields.legalAddress).toMatch(/100 Main Street/)
    expect(filled.pdfFilledFields).toEqual(expect.arrayContaining(['ein', 'legalAddress', 'avgMonthlyRevenue']))
    expect(filled.pdfFilledFields).not.toContain('businessName')
    expect(filled.pdfFilledFields).not.toContain('requestedAmount')
  })
})
