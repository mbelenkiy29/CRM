import { buildImportPreview } from '../buildPreview'
import { commitReviewedImport } from '../commitImport'
import type { ImportPersistence } from '../types'

const CSV = `Lead dump
Business Name,Requested Amount,State,SSN,Originator
Acme LLC,50000,TX,123-45-6789,Jane Doe
,25000,FL,987-65-4321,Sam Rep
`

describe('buildImportPreview', () => {
  it('builds a review payload with mappings, file matches, assignments, and failures', () => {
    const preview = buildImportPreview({
      source: 'csv',
      spreadsheetText: CSV,
      files: [
        { path: 'Acme LLC/bank_statement.pdf', name: 'bank_statement.pdf' },
        { path: 'Acme LLC/application.pdf', name: 'application.pdf' },
      ],
      assignmentMethod: 'originator_column',
      originatorDirectory: [
        { name: 'Jane Doe', userId: 'user-jane' },
        { name: 'Sam Rep', userId: 'user-sam' },
      ],
      applicationTexts: {
        'Acme LLC/application.pdf': 'Legal Name: Acme LLC\nEIN: 11-2233445\nLegal Address: 9 Oak Ave, Dallas, TX 75001',
      },
    })

    expect(preview.headerRowIndex).toBe(1)
    expect(preview.dealCount).toBe(1)
    expect(preview.failureCount).toBe(1)
    expect(preview.sensitiveHeaders).toEqual(['SSN'])
    expect(preview.suggestedColumnMap['Business Name']).toBe('businessName')
    expect(preview.rows[0]?.ownerUserId).toBe('user-jane')
    expect(preview.rows[0]?.files).toHaveLength(2)
    expect(preview.rows[0]?.pdfFilledFields).toEqual(expect.arrayContaining(['ein', 'legalAddress']))
    expect(preview.rows[0]?.fields.requestedAmount).toBe('50000')
    expect(preview.rows[1]?.failureReason).toBe('business_name_required')
  })
})

describe('commitReviewedImport', () => {
  it('creates only ready rows and builds a results CSV without SSNs', async () => {
    const created: string[] = []
    const persistence: ImportPersistence = {
      createLeadSource: async () => ({ id: 'source-1' }),
      createLeadBatch: async () => ({ id: 'batch-1' }),
      saveMapping: async () => ({ id: 'map-1' }),
      createImportJob: async () => ({ id: 'job-1' }),
      completeImportJob: async () => undefined,
      createDeal: async (input) => {
        created.push(input.businessName ?? '')
        return { id: `deal-${created.length}` }
      },
      createDocument: async () => undefined,
      updateRoundRobinCursor: async () => undefined,
    }

    const preview = buildImportPreview({
      source: 'csv',
      spreadsheetText: CSV,
      assignmentMethod: 'round_robin',
      assigneeUserIds: ['user-a', 'user-b'],
    })
    const result = await commitReviewedImport({
      source: 'csv',
      rows: preview.rows,
      columnMap: preview.confirmedColumnMap,
      assignmentMethod: 'round_robin',
      leadSourceName: 'Purchased pack',
      leadBatchName: 'April dump',
      saveMappingAs: 'Vendor A',
    }, persistence)

    expect(created).toEqual(['Acme LLC'])
    expect(result.dealCount).toBe(1)
    expect(result.failureCount).toBe(1)
    expect(result.resultsCsv).toContain('deal-1')
    expect(result.resultsCsv).not.toMatch(/\bSSN\b/i)
    expect(result.resultsCsv).not.toContain('123-45-6789')
  })
})
