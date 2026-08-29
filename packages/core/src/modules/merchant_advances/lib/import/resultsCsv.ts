import { MCA_IMPORT_RESULT_CSV_HEADERS } from '../../data/constants'
import { isSensitiveHeader, looksLikeSsn } from './normalize'
import type { ImportPreviewRow, ImportResultCsvRow } from './types'

const DEAL_PATH_PREFIX = '/backend/merchant_advances?id='

function csvEscape(value: string | null | undefined): string {
  const text = value ?? ''
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function dealUrlFor(dealId: string | null): string | null {
  return dealId ? `${DEAL_PATH_PREFIX}${dealId}` : null
}

export function toResultCsvRow(row: ImportPreviewRow, dealId: string | null = null): ImportResultCsvRow {
  return {
    rowIndex: row.rowIndex,
    businessName: row.businessName,
    dealId,
    dealUrl: dealUrlFor(dealId),
    ownerUserId: row.ownerUserId,
    assignmentMethod: row.assignmentMethod,
    fileCount: row.files.length,
    classifications: row.files.map((file) => file.classification).join('|'),
    status: row.status,
    failureReason: row.failureReason,
    pdfFilledFields: row.pdfFilledFields.join('|'),
  }
}

export function assertNoSensitiveResultValues(row: ImportResultCsvRow): void {
  const values = Object.values(row).map((value) => (value == null ? '' : String(value)))
  for (const value of values) {
    if (looksLikeSsn(value)) {
      throw new Error('[internal] import result CSV refused to include an SSN value')
    }
  }
}

export function buildResultsCsv(rows: ImportResultCsvRow[]): string {
  for (const row of rows) assertNoSensitiveResultValues(row)
  const headerLine = MCA_IMPORT_RESULT_CSV_HEADERS.join(',')
  const lines = rows.map((row) =>
    MCA_IMPORT_RESULT_CSV_HEADERS.map((key) => csvEscape(row[key] == null ? '' : String(row[key]))).join(','),
  )
  return [headerLine, ...lines].join('\n') + '\n'
}

export function filterHeadersForMapping(headers: string[]): string[] {
  return headers.filter((header) => !isSensitiveHeader(header))
}
