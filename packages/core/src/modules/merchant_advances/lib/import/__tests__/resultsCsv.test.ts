import { buildResultsCsv, toResultCsvRow } from '../resultsCsv'
import type { ImportPreviewRow } from '../types'

function sampleRow(overrides: Partial<ImportPreviewRow> = {}): ImportPreviewRow {
  return {
    rowIndex: 1,
    businessName: 'Acme LLC',
    fields: {
      businessName: 'Acme LLC',
      requestedAmount: '50000',
      avgMonthlyRevenue: null,
      timeInBusinessMonths: null,
      position: 1,
      industry: 'auto repair',
      state: 'TX',
      ein: '12-3456789',
      legalAddress: '1 Main St',
      originator: 'Jane',
      folderName: null,
      startDate: null,
    },
    pdfFilledFields: ['ein'],
    files: [{ path: 'Acme LLC/statement.pdf', name: 'statement.pdf', classification: 'statement' }],
    ownerUserId: 'user-1',
    originatorValue: 'Jane',
    assignmentMethod: 'round_robin',
    status: 'ready',
    failureReason: null,
    ...overrides,
  }
}

describe('buildResultsCsv', () => {
  it('exports deal links, assignment, file counts, and failures without SSNs or full dumps', () => {
    const csv = buildResultsCsv([
      toResultCsvRow(sampleRow(), 'deal-1'),
      toResultCsvRow(sampleRow({
        rowIndex: 2,
        businessName: null,
        status: 'failed',
        failureReason: 'business_name_required',
        files: [],
        pdfFilledFields: [],
      }), null),
    ])
    expect(csv).toContain('dealId,dealUrl,ownerUserId')
    expect(csv).toContain('/backend/merchant_advances?id=deal-1')
    expect(csv).toContain('business_name_required')
    expect(csv).not.toMatch(/\bSSN\b/i)
    expect(csv).not.toContain('123-45-6789')
    expect(csv).not.toContain('12-3456789')
    expect(csv).not.toContain('1 Main St')
  })

  it('refuses to emit a row that still contains an SSN-shaped value', () => {
    expect(() => buildResultsCsv([{
      rowIndex: 1,
      businessName: 'Acme LLC',
      dealId: 'deal-1',
      dealUrl: '/backend/merchant_advances?id=deal-1',
      ownerUserId: '123-45-6789',
      assignmentMethod: 'manual',
      fileCount: 0,
      classifications: '',
      status: 'ready',
      failureReason: null,
      pdfFilledFields: '',
    }])).toThrow(/SSN/)
  })
})
