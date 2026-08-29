import { classifyFileName } from './classifyFile'
import { folderStem, similarity } from './normalize'
import type { ImportFileRef, MatchedImportFile, SpreadsheetRow } from './types'

const MATCH_THRESHOLD = 0.72

export type RowIdentity = {
  rowIndex: number
  businessName: string | null
  folderName: string | null
}

export type FileMatchResult = {
  matches: Map<number, MatchedImportFile[]>
  unmatched: ImportFileRef[]
}

function rowMatchName(row: RowIdentity): string | null {
  return row.folderName || row.businessName
}

function scoreFileToRow(file: ImportFileRef, row: RowIdentity): number {
  const target = rowMatchName(row)
  if (!target) return 0
  const folder = folderStem(file.path || file.name)
  const fileName = file.name.replace(/\.[a-z0-9]+$/i, '')
  return Math.max(similarity(folder, target), similarity(fileName, target), similarity(file.path, target))
}

export function matchFilesToRows(rows: RowIdentity[], files: ImportFileRef[]): FileMatchResult {
  const matches = new Map<number, MatchedImportFile[]>()
  const unmatched: ImportFileRef[] = []

  for (const file of files) {
    let bestRow: RowIdentity | null = null
    let bestScore = 0
    for (const row of rows) {
      const score = scoreFileToRow(file, row)
      if (score > bestScore) {
        bestScore = score
        bestRow = row
      }
    }
    if (!bestRow || bestScore < MATCH_THRESHOLD) {
      unmatched.push(file)
      continue
    }
    const current = matches.get(bestRow.rowIndex) ?? []
    current.push({
      ...file,
      classification: classifyFileName(file.name || file.path),
    })
    matches.set(bestRow.rowIndex, current)
  }

  return { matches, unmatched }
}

export function identitiesFromMappedRows(
  rows: Array<{ rowIndex: number; businessName: string | null; folderName: string | null }>,
): RowIdentity[] {
  return rows.map((row) => ({
    rowIndex: row.rowIndex,
    businessName: row.businessName,
    folderName: row.folderName,
  }))
}

export function spreadsheetFolderHint(row: SpreadsheetRow, folderColumnIndex: number | null): string | null {
  if (folderColumnIndex === null) return null
  const value = row[folderColumnIndex]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
