import { MCA_IMPORT_FIELD_KEYS, type McaImportFieldKey } from '../../data/constants'
import { isSensitiveHeader, normalizeLabel } from './normalize'
import type { ColumnMap, SpreadsheetRow, SuggestColumnMapFn } from './types'

const HEADER_ALIASES: Record<McaImportFieldKey, string[]> = {
  businessName: [
    'business name',
    'business',
    'company',
    'company name',
    'dba',
    'dba name',
    'merchant',
    'merchant name',
    'legal name',
    'store name',
    'doing business as',
  ],
  requestedAmount: [
    'requested amount',
    'request amount',
    'amount requested',
    'requested',
    'advance amount',
    'funding amount',
    'amount',
  ],
  avgMonthlyRevenue: [
    'avg monthly revenue',
    'average monthly revenue',
    'monthly revenue',
    'amr',
    'revenue',
    'monthly sales',
    'avg revenue',
  ],
  timeInBusinessMonths: [
    'time in business months',
    'tib months',
    'months in business',
    'time in business',
    'tib',
  ],
  timeInBusinessYears: [
    'time in business years',
    'years in business',
    'tib years',
    'years',
  ],
  position: ['position', 'pos', 'current position', 'mca position'],
  industry: ['industry', 'naics', 'sic', 'business type', 'vertical'],
  state: ['state', 'st', 'province', 'merchant state'],
  ein: ['ein', 'fein', 'federal ein', 'tax id', 'employer id', 'employer identification number'],
  legalAddress: [
    'legal address',
    'address',
    'street address',
    'business address',
    'address line 1',
    'street',
  ],
  originator: [
    'originator',
    'owner',
    'assigned to',
    'rep',
    'iso rep',
    'account executive',
    'ae',
  ],
  folderName: ['folder', 'folder name', 'file folder', 'package', 'package name'],
  startDate: ['start date', 'business start', 'opened', 'open date', 'date opened'],
}

const KNOWN_HEADER_SET = new Set(
  Object.values(HEADER_ALIASES).flatMap((aliases) => aliases),
)

export function detectHeaderRow(rows: SpreadsheetRow[]): { index: number; headers: string[]; score: number } {
  if (rows.length === 0) {
    return { index: 0, headers: [], score: 0 }
  }

  const scanLimit = Math.min(rows.length, 10)
  let bestIndex = 0
  let bestScore = Number.NEGATIVE_INFINITY

  for (let index = 0; index < scanLimit; index += 1) {
    const row = rows[index] ?? []
    const cells = row.map((cell) => cell.trim()).filter((cell) => cell.length > 0)
    if (cells.length === 0) continue

    const uniqueCount = new Set(cells.map((cell) => normalizeLabel(cell))).size
    const aliasHits = cells.filter((cell) => KNOWN_HEADER_SET.has(normalizeLabel(cell))).length
    const numericCount = cells.filter((cell) => /^[\d,.$%-]+$/.test(cell)).length
    const shortTitlePenalty = cells.length <= 2 && aliasHits === 0 ? 4 : 0
    const score = aliasHits * 4 + uniqueCount - numericCount * 3 - shortTitlePenalty

    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }

  const headers = (rows[bestIndex] ?? []).map((cell) => cell.trim())
  return { index: bestIndex, headers, score: bestScore }
}

function aliasMatch(header: string): McaImportFieldKey | null {
  const normalized = normalizeLabel(header)
  if (!normalized) return null
  for (const key of MCA_IMPORT_FIELD_KEYS) {
    if (HEADER_ALIASES[key].includes(normalized)) return key
  }
  return null
}

export function suggestColumnMap(
  headers: string[],
  suggestFn?: SuggestColumnMapFn,
): {
  map: ColumnMap
  unmapped: string[]
  sensitive: string[]
} {
  const map: ColumnMap = {}
  const unmapped: string[] = []
  const sensitive: string[] = []
  const usedFields = new Set<McaImportFieldKey>()

  for (const header of headers) {
    if (!header.trim()) {
      map[header] = null
      continue
    }
    if (isSensitiveHeader(header)) {
      map[header] = null
      sensitive.push(header)
      continue
    }
    const matched = aliasMatch(header)
    if (matched && !usedFields.has(matched)) {
      map[header] = matched
      usedFields.add(matched)
      continue
    }
    map[header] = null
    unmapped.push(header)
  }

  if (suggestFn && unmapped.length > 0) {
    const suggested = suggestFn(unmapped)
    for (const header of unmapped.slice()) {
      const field = suggested[header]
      if (!field || usedFields.has(field) || !MCA_IMPORT_FIELD_KEYS.includes(field)) continue
      map[header] = field
      usedFields.add(field)
      const remainingIndex = unmapped.indexOf(header)
      if (remainingIndex >= 0) unmapped.splice(remainingIndex, 1)
    }
  }

  return { map, unmapped, sensitive }
}

export function mergeColumnMap(headers: string[], suggested: ColumnMap, confirmed?: ColumnMap | null): ColumnMap {
  if (!confirmed) return { ...suggested }
  const merged: ColumnMap = {}
  for (const header of headers) {
    if (Object.prototype.hasOwnProperty.call(confirmed, header)) {
      merged[header] = confirmed[header] ?? null
    } else {
      merged[header] = suggested[header] ?? null
    }
  }
  return merged
}
