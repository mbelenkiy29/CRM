import { expect, test } from '@playwright/test'
import { apiRequest, getAuthToken } from '@open-mercato/core/modules/core/__integration__/helpers/api'
import { readJsonSafe } from '@open-mercato/core/modules/core/__integration__/helpers/generalFixtures'

const CSV = `Lead dump
Business Name,Requested Amount,State,SSN,Originator
Acme Import LLC,50000,TX,123-45-6789,Jane Doe
,25000,FL,987-65-4321,Sam Rep
`

test.describe('TC-MCA-IMPORT-001: bulk deal import preview and commit', () => {
  test('previews CSV mapping, requires review, commits ready rows, and omits SSNs from results', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const createdIds: string[] = []

    try {
      const unauthenticated = await request.post('/api/merchant_advances/imports/preview', {
        headers: { Cookie: '' },
        data: { source: 'csv', spreadsheetText: CSV },
      })
      expect(unauthenticated.status(), 'preview should require auth').toBe(401)

      const preview = await apiRequest(request, 'POST', '/api/merchant_advances/imports/preview', {
        token: adminToken,
        data: {
          source: 'csv',
          spreadsheetText: CSV,
          files: [{ path: 'Acme Import LLC/bank_statement.pdf', name: 'bank_statement.pdf' }],
          assignmentMethod: 'manual',
        },
      })
      const previewBody = await readJsonSafe<{
        dealCount?: number
        failureCount?: number
        sensitiveHeaders?: string[]
        rows?: Array<{
          businessName?: string | null
          status?: string
          files?: Array<{ classification?: string }>
          fields?: { ein?: string | null }
        }>
        suggestedColumnMap?: Record<string, string | null>
        error?: string
      }>(preview)
      expect(preview.status(), `preview should succeed: ${JSON.stringify(previewBody)}`).toBe(200)
      expect(previewBody?.dealCount).toBe(1)
      expect(previewBody?.failureCount).toBe(1)
      expect(previewBody?.sensitiveHeaders).toEqual(['SSN'])
      expect(previewBody?.suggestedColumnMap?.['Business Name']).toBe('businessName')
      expect(previewBody?.rows?.[0]?.files?.[0]?.classification).toBe('statement')

      const emptyCommit = await apiRequest(request, 'POST', '/api/merchant_advances/imports/commit', {
        token: adminToken,
        data: {
          source: 'csv',
          rows: (previewBody?.rows ?? []).map((row) => ({ ...row, status: 'failed', failureReason: 'business_name_required' })),
          columnMap: previewBody?.suggestedColumnMap ?? {},
          assignmentMethod: 'manual',
        },
      })
      expect(emptyCommit.status(), 'commit without ready rows should be rejected').toBe(400)

      const commit = await apiRequest(request, 'POST', '/api/merchant_advances/imports/commit', {
        token: adminToken,
        data: {
          source: 'csv',
          rows: previewBody?.rows,
          columnMap: previewBody?.suggestedColumnMap,
          assignmentMethod: 'manual',
          leadSourceName: 'QA import pack',
          leadBatchName: 'QA import batch',
          saveMappingAs: 'QA vendor',
        },
      })
      const commitBody = await readJsonSafe<{
        ok?: boolean
        dealIds?: string[]
        resultsCsv?: string | null
        dealCount?: number
        error?: string
      }>(commit)
      expect([200, 202], `commit should accept reviewed rows: ${JSON.stringify(commitBody)}`).toContain(commit.status())
      expect(commitBody?.resultsCsv ?? '').not.toMatch(/\bSSN\b/i)
      expect(commitBody?.resultsCsv ?? '').not.toContain('123-45-6789')
      for (const id of commitBody?.dealIds ?? []) createdIds.push(id)

      if (createdIds[0]) {
        const listed = await apiRequest(request, 'GET', `/api/merchant_advances/deals?search=${encodeURIComponent('Acme Import LLC')}`, {
          token: adminToken,
        })
        expect(listed.status()).toBe(200)
      }
    } finally {
      for (const id of createdIds) {
        await apiRequest(request, 'DELETE', `/api/merchant_advances/deals?id=${encodeURIComponent(id)}`, {
          token: adminToken,
        })
      }
    }
  })
})
