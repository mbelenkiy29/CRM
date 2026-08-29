import type { McaAssignmentMethod, McaImportFieldKey } from '../../data/constants'
import { assignRows } from './assign'
import { detectHeaderRow, mergeColumnMap, suggestColumnMap } from './detectHeaders'
import { extractApplicationFields, fillMissingFieldsFromPdf } from './fillFromApplicationPdf'
import { identitiesFromMappedRows, matchFilesToRows } from './matchFiles'
import { parseSpreadsheet } from './parseSpreadsheet'
import { trimCell } from './normalize'
import type {
  ColumnMap,
  ImportFileRef,
  ImportPreviewResult,
  ImportPreviewRow,
  MappedDealFields,
  OriginatorDirectoryEntry,
  SuggestColumnMapFn,
} from './types'

const EMPTY_FIELDS: MappedDealFields = {
  businessName: null,
  requestedAmount: null,
  avgMonthlyRevenue: null,
  timeInBusinessMonths: null,
  position: null,
  industry: null,
  state: null,
  ein: null,
  legalAddress: null,
  originator: null,
  folderName: null,
  startDate: null,
}

function parseInteger(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseMoney(value: string | null): string | null {
  if (!value) return null
  const cleaned = value.replace(/[$,\s]/g, '')
  if (!cleaned) return null
  const numeric = Number(cleaned)
  return Number.isFinite(numeric) ? cleaned : value.trim()
}

function mapRowCells(headers: string[], cells: string[], columnMap: ColumnMap): MappedDealFields {
  const fields: MappedDealFields = { ...EMPTY_FIELDS }
  let years: number | null = null
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index] ?? ''
    const field = columnMap[header]
    if (!field) continue
    const raw = trimCell(cells[index])
    if (!raw) continue
    applyMappedValue(fields, field, raw)
    if (field === 'timeInBusinessYears') years = parseInteger(raw)
  }
  if (fields.timeInBusinessMonths == null && years != null) {
    fields.timeInBusinessMonths = years * 12
  }
  return fields
}

function applyMappedValue(fields: MappedDealFields, field: McaImportFieldKey, raw: string): void {
  if (field === 'timeInBusinessMonths') {
    fields.timeInBusinessMonths = parseInteger(raw)
    return
  }
  if (field === 'timeInBusinessYears') {
    return
  }
  if (field === 'position') {
    fields.position = parseInteger(raw)
    return
  }
  if (field === 'requestedAmount' || field === 'avgMonthlyRevenue') {
    fields[field] = parseMoney(raw)
    return
  }
  if (field === 'businessName') {
    fields.businessName = raw
    return
  }
  if (field === 'industry') {
    fields.industry = raw
    return
  }
  if (field === 'state') {
    fields.state = raw
    return
  }
  if (field === 'ein') {
    fields.ein = raw
    return
  }
  if (field === 'legalAddress') {
    fields.legalAddress = raw
    return
  }
  if (field === 'originator') {
    fields.originator = raw
    return
  }
  if (field === 'folderName') {
    fields.folderName = raw
    return
  }
  if (field === 'startDate') {
    fields.startDate = raw
  }
}

function failureForRow(businessName: string | null, assignmentFailure: string | null): string | null {
  if (!businessName) return 'business_name_required'
  return assignmentFailure
}

export function buildImportPreview(input: {
  source: ImportPreviewResult['source']
  spreadsheetText: string
  filename?: string | null
  columnMap?: ColumnMap | null
  files?: ImportFileRef[]
  assignmentMethod?: McaAssignmentMethod
  assigneeUserIds?: string[]
  originatorDirectory?: OriginatorDirectoryEntry[]
  roundRobinCursorUserId?: string | null
  applicationTexts?: Record<string, string>
  suggestFn?: SuggestColumnMapFn
}): ImportPreviewResult {
  const parsed = parseSpreadsheet({
    text: input.spreadsheetText,
    source: input.source,
    filename: input.filename,
  })
  const header = detectHeaderRow(parsed.rows)
  const dataRows = parsed.rows.slice(header.index + 1)
  const suggested = suggestColumnMap(header.headers, input.suggestFn)
  const confirmedColumnMap = mergeColumnMap(header.headers, suggested.map, input.columnMap)

  const mapped = dataRows.map((cells, offset) => {
    const fields = mapRowCells(header.headers, cells, confirmedColumnMap)
    return {
      rowIndex: header.index + 1 + offset,
      fields,
      pdfFilledFields: [] as string[],
    }
  })

  const applicationTexts = input.applicationTexts ?? {}
  const identities = identitiesFromMappedRows(
    mapped.map((row) => ({
      rowIndex: row.rowIndex,
      businessName: row.fields.businessName,
      folderName: row.fields.folderName,
    })),
  )
  const fileMatch = matchFilesToRows(identities, input.files ?? [])

  for (const row of mapped) {
    const files = fileMatch.matches.get(row.rowIndex) ?? []
    const application = files.find((file) => file.classification === 'application')
    const pdfText = application ? applicationTexts[application.path] ?? applicationTexts[application.name] : null
    if (!pdfText) continue
    const filled = fillMissingFieldsFromPdf(row.fields, extractApplicationFields(pdfText))
    row.fields = filled.fields
    row.pdfFilledFields = filled.pdfFilledFields
  }

  const assignmentMethod = input.assignmentMethod ?? 'manual'
  const assigned = assignRows(
    mapped.map((row) => ({
      ...row,
      originatorValue: row.fields.originator,
    })),
    {
      assignmentMethod,
      originatorDirectory: input.originatorDirectory ?? [],
      assigneeUserIds: input.assigneeUserIds ?? [],
      roundRobinCursorUserId: input.roundRobinCursorUserId ?? null,
    },
  )

  const rows: ImportPreviewRow[] = assigned.rows.map((row) => {
    const files = fileMatch.matches.get(row.rowIndex) ?? []
    const failureReason = failureForRow(row.fields.businessName, row.assignmentFailure)
    return {
      rowIndex: row.rowIndex,
      businessName: row.fields.businessName,
      fields: row.fields,
      pdfFilledFields: row.pdfFilledFields,
      files,
      ownerUserId: failureReason ? null : row.ownerUserId,
      originatorValue: row.fields.originator,
      assignmentMethod,
      status: failureReason ? 'failed' : 'ready',
      failureReason,
    }
  })

  return {
    source: input.source,
    dealCount: rows.filter((row) => row.status === 'ready').length,
    failureCount: rows.filter((row) => row.status === 'failed').length,
    headerRowIndex: header.index,
    headers: header.headers,
    suggestedColumnMap: suggested.map,
    confirmedColumnMap,
    unmappedHeaders: suggested.unmapped.filter((headerName) => confirmedColumnMap[headerName] == null),
    sensitiveHeaders: suggested.sensitive,
    rows,
    unmatchedFiles: fileMatch.unmatched,
    assignmentMethod,
  }
}
