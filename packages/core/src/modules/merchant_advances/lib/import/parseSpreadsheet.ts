import type { McaImportSource } from '../../data/constants'
import type { SpreadsheetRow } from './types'

export type ParsedSpreadsheet = {
  delimiter: ',' | ';' | '\t'
  rows: SpreadsheetRow[]
}

function stripUtf8Bom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value
}

function countUnquoted(text: string, delimiter: string): number {
  let count = 0
  let inQuotes = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        index += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && char === delimiter) count += 1
  }
  return count
}

export function detectSpreadsheetDelimiter(text: string, source?: McaImportSource): ',' | ';' | '\t' {
  if (source === 'tsv') return '\t'
  const sample = stripUtf8Bom(text).slice(0, 64 * 1024)
  const comma = countUnquoted(sample, ',')
  const semi = countUnquoted(sample, ';')
  const tab = countUnquoted(sample, '\t')
  if (tab > comma && tab > semi) return '\t'
  if (semi > comma) return ';'
  return ','
}

export function parseDelimitedText(text: string, delimiter: ',' | ';' | '\t'): SpreadsheetRow[] {
  const rows: SpreadsheetRow[] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false
  const normalized = stripUtf8Bom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const next = normalized[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentCell += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentCell += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === delimiter) {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }
    if (char === '\n') {
      currentRow.push(currentCell)
      currentCell = ''
      if (currentRow.some((cell) => cell.trim().length > 0)) rows.push(currentRow)
      currentRow = []
      continue
    }
    currentCell += char
  }

  currentRow.push(currentCell)
  if (currentRow.some((cell) => cell.trim().length > 0)) rows.push(currentRow)
  return rows
}

export function parseSpreadsheet(input: {
  text: string
  source: McaImportSource
  filename?: string | null
}): ParsedSpreadsheet {
  const filename = (input.filename ?? '').toLowerCase()
  if (input.source === 'xlsx' || input.source === 'xls' || filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
    throw new Error('[internal] XLSX/XLS parsing is not implemented yet; upload CSV or TSV')
  }
  if (input.source === 'zip' || input.source === 'gdrive' || input.source === 'email') {
    throw new Error(`[internal] ${input.source} import is not implemented yet`)
  }
  const delimiter = detectSpreadsheetDelimiter(input.text, input.source)
  return { delimiter, rows: parseDelimitedText(input.text, delimiter) }
}

export function inferSourceFromFilename(filename: string): McaImportSource {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.tsv')) return 'tsv'
  if (lower.endsWith('.xlsx')) return 'xlsx'
  if (lower.endsWith('.xls')) return 'xls'
  if (lower.endsWith('.zip')) return 'zip'
  return 'csv'
}
