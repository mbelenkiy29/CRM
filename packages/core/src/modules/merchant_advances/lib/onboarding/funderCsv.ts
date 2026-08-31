import { looksLikeSsn } from '../import/normalize'
import { parseDelimitedText, detectSpreadsheetDelimiter } from '../import/parseSpreadsheet'
import { parseFunderCriteria, FUNDER_CRITERIA_KEYS, type FunderCriteria } from '../funderScore'
import { MCA_ONBOARDING_FUNDER_ROUTES, type McaOnboardingFunderRoute } from './types'
import type { McaSubmitMethod } from '../../data/constants'

export type FunderCsvDraft = {
  rowIndex: number
  name: string
  code: string | null
  route: McaOnboardingFunderRoute
  submitEmail: string | null
  fromAddressOverride: string | null
  requiresUnstampedStatements: boolean
  criteria: FunderCriteria
  status: 'ready' | 'failed'
  failureReason: string | null
  rejectedCells: string[]
}

export type FunderCsvPreview = {
  rows: FunderCsvDraft[]
  readyCount: number
  failedCount: number
  rejectedSsnCount: number
}

const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  funder: 'name',
  fundername: 'name',
  code: 'code',
  route: 'route',
  method: 'route',
  submitmethod: 'route',
  contactemail: 'submitEmail',
  email: 'submitEmail',
  submitemail: 'submitEmail',
  fromaddress: 'fromAddressOverride',
  from: 'fromAddressOverride',
  requiresunstampedstatements: 'requiresUnstampedStatements',
  unstamped: 'requiresUnstampedStatements',
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function mapRoute(value: string | null): McaOnboardingFunderRoute {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (normalized === 'api' || normalized === 'api_deferred' || normalized === 'apideferred') return 'api_deferred'
  if ((MCA_ONBOARDING_FUNDER_ROUTES as readonly string[]).includes(normalized)) {
    return normalized as McaOnboardingFunderRoute
  }
  return 'email'
}

export function routeToSubmitMethod(route: McaOnboardingFunderRoute): McaSubmitMethod {
  return route === 'api_deferred' ? 'api' : route
}

function parseBooleanCell(value: string | null): boolean {
  if (!value) return false
  return /^(1|true|yes|y)$/i.test(value.trim())
}

function criteriaFromRow(row: Record<string, string>): FunderCriteria {
  const raw: Record<string, unknown> = {}
  for (const key of FUNDER_CRITERIA_KEYS) {
    const cell = row[key]
    if (!cell) continue
    if (key.endsWith('Ok') || key.startsWith('allow') || key === 'weekendDepositsOk' || key === 'bankruptcyOk' || key === 'allowStacking') {
      raw[key] = parseBooleanCell(cell)
      continue
    }
    if (
      key.startsWith('min')
      || key.startsWith('max')
    ) {
      const numeric = Number(cell)
      if (Number.isFinite(numeric)) raw[key] = numeric
      continue
    }
    raw[key] = cell.split('|').map((part) => part.trim()).filter(Boolean)
  }
  return parseFunderCriteria(raw)
}

export function previewFunderCsv(spreadsheetText: string): FunderCsvPreview {
  const delimiter = detectSpreadsheetDelimiter(spreadsheetText)
  const parsed = parseDelimitedText(spreadsheetText, delimiter)
  if (parsed.length === 0) {
    return { rows: [], readyCount: 0, failedCount: 0, rejectedSsnCount: 0 }
  }
  const headerRow = parsed[0] ?? []
  const headers = headerRow.map((header) => {
    const normalized = normalizeHeader(header)
    if (HEADER_ALIASES[normalized]) return HEADER_ALIASES[normalized]
    const criteriaKey = (FUNDER_CRITERIA_KEYS as readonly string[]).find((key) => key.toLowerCase() === normalized)
    return criteriaKey ?? header
  })
  const rows: FunderCsvDraft[] = []
  let rejectedSsnCount = 0

  parsed.slice(1).forEach((cells, offset) => {
    const rowIndex = offset + 1
    const mapped: Record<string, string> = {}
    const rejectedCells: string[] = []
    cells.forEach((cell, index) => {
      const header = headers[index] ?? `col_${index}`
      if (looksLikeSsn(cell)) {
        rejectedCells.push(header)
        rejectedSsnCount += 1
        return
      }
      mapped[header] = cell
    })
    const name = (mapped.name ?? '').trim()
    if (!name) {
      rows.push({
        rowIndex,
        name: '',
        code: null,
        route: 'email',
        submitEmail: null,
        fromAddressOverride: null,
        requiresUnstampedStatements: false,
        criteria: {},
        status: 'failed',
        failureReason: 'name_required',
        rejectedCells,
      })
      return
    }
    rows.push({
      rowIndex,
      name,
      code: mapped.code?.trim() || null,
      route: mapRoute(mapped.route ?? null),
      submitEmail: mapped.submitEmail?.trim() || null,
      fromAddressOverride: mapped.fromAddressOverride?.trim() || null,
      requiresUnstampedStatements: parseBooleanCell(mapped.requiresUnstampedStatements ?? null),
      criteria: criteriaFromRow(mapped),
      status: 'ready',
      failureReason: null,
      rejectedCells,
    })
  })

  return {
    rows,
    readyCount: rows.filter((row) => row.status === 'ready').length,
    failedCount: rows.filter((row) => row.status === 'failed').length,
    rejectedSsnCount,
  }
}

export function readyFunderCsvRows(preview: FunderCsvPreview): FunderCsvDraft[] {
  return preview.rows.filter((row) => row.status === 'ready')
}
