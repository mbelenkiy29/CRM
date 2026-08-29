export type StatementMetrics = {
  avgMonthlyRevenue: number | null
  avgDailyBalance: number | null
  depositCount: number | null
  nsfCount: number | null
  negativeDays: number | null
  existingPositions: number | null
}

const EMPTY_METRICS: StatementMetrics = {
  avgMonthlyRevenue: null,
  avgDailyBalance: null,
  depositCount: null,
  nsfCount: null,
  negativeDays: null,
  existingPositions: null,
}

const MONEY_RE = /(?:usd\s*)?\$?\s*\(?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*\)?/i
const INT_RE = /([0-9]{1,6})/
const ORDINAL_RE = /\b([1-9]|1[0-9]|20)(?:st|nd|rd|th)\b/i

type MetricKey = keyof StatementMetrics

const LABEL_ALIASES: Record<MetricKey, RegExp[]> = {
  avgMonthlyRevenue: [
    /average\s+monthly\s+(?:revenue|deposits?|sales)/i,
    /\bamr\b/i,
    /avg\.?\s*monthly\s+(?:rev(?:enue)?|deposits?)/i,
    /monthly\s+average\s+(?:revenue|deposits?)/i,
    /total\s+deposits?\s+this\s+month/i,
  ],
  avgDailyBalance: [
    /average\s+daily\s+balance/i,
    /\badb\b/i,
    /avg\.?\s*daily\s+bal(?:ance)?/i,
    /avg\.?\s*balance/i,
  ],
  depositCount: [
    /(?:number|count|#)\s+of\s+deposits?/i,
    /deposit\s+count/i,
    /#\s*deposits?/i,
  ],
  nsfCount: [
    /\bnsf(?:s)?\b(?:\s+count)?/i,
    /returned\s+items?/i,
    /overdrafts?/i,
    /non[- ]sufficient\s+funds/i,
  ],
  negativeDays: [
    /negative\s+days?/i,
    /days?\s+negative/i,
    /neg(?:ative)?\s+bal(?:ance)?\s+days?/i,
  ],
  existingPositions: [
    /existing\s+positions?/i,
    /current\s+(?:mca\s+)?positions?/i,
    /mca\s+positions?/i,
    /current\s+mca/i,
    /stack(?:ing)?/i,
  ],
}

const TABLE_HEADER_ALIASES: Record<MetricKey, RegExp[]> = {
  avgMonthlyRevenue: [
    /total\s+deposits?/i,
    /monthly\s+(?:revenue|deposits?)/i,
    /\bamr\b/i,
    /deposits?\s+total/i,
  ],
  avgDailyBalance: [
    /average\s+daily\s+balance/i,
    /\badb\b/i,
    /avg\.?\s*daily\s+bal/i,
  ],
  depositCount: [
    /#\s*deposits?/i,
    /deposit\s+count/i,
    /number\s+of\s+deposits?/i,
  ],
  nsfCount: [/\bnsf(?:s)?\b/i, /returned/i, /overdraft/i],
  negativeDays: [/negative\s+days?/i, /days?\s+neg/i],
  existingPositions: [/positions?/i, /stack/i, /mca/i],
}

export function parseMoneyToken(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const negative = trimmed.includes('(') && trimmed.includes(')')
  const match = trimmed.match(MONEY_RE)
  if (!match?.[1]) return null
  const value = Number(match[1].replace(/,/g, ''))
  if (!Number.isFinite(value)) return null
  return negative ? -value : value
}

export function parseCountToken(raw: string): number | null {
  const ordinal = raw.match(ORDINAL_RE)
  if (ordinal?.[1]) {
    const value = Number(ordinal[1])
    return Number.isInteger(value) ? value : null
  }
  const match = raw.match(INT_RE)
  if (!match?.[1]) return null
  const value = Number(match[1])
  return Number.isInteger(value) ? value : null
}

function emptyMetrics(): StatementMetrics {
  return { ...EMPTY_METRICS }
}

function firstDefined<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return value
  }
  return null
}

function average(values: number[]): number | null {
  const usable = values.filter((value) => Number.isFinite(value))
  if (!usable.length) return null
  return usable.reduce((sum, value) => sum + value, 0) / usable.length
}

function sum(values: number[]): number | null {
  const usable = values.filter((value) => Number.isFinite(value))
  if (!usable.length) return null
  return usable.reduce((total, value) => total + value, 0)
}

function splitMarkdownRow(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return []
  return trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))
}

function matchHeaderKey(header: string): MetricKey | null {
  for (const [key, patterns] of Object.entries(TABLE_HEADER_ALIASES) as Array<[MetricKey, RegExp[]]>) {
    if (patterns.some((pattern) => pattern.test(header))) return key
  }
  return null
}

function extractFromTables(markdown: string): Partial<StatementMetrics> {
  const lines = markdown.split(/\r?\n/)
  const collected: Record<MetricKey, number[]> = {
    avgMonthlyRevenue: [],
    avgDailyBalance: [],
    depositCount: [],
    nsfCount: [],
    negativeDays: [],
    existingPositions: [],
  }

  for (let index = 0; index < lines.length - 1; index += 1) {
    const headerCells = splitMarkdownRow(lines[index] ?? '')
    if (headerCells.length < 2) continue
    const nextCells = splitMarkdownRow(lines[index + 1] ?? '')
    if (!isSeparatorRow(nextCells)) continue

    const columnKeys = headerCells.map((cell) => matchHeaderKey(cell))
    if (!columnKeys.some(Boolean)) continue

    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const rowCells = splitMarkdownRow(lines[rowIndex] ?? '')
      if (rowCells.length < 2) break
      if (isSeparatorRow(rowCells)) break
      columnKeys.forEach((key, columnIndex) => {
        if (!key) return
        const cell = rowCells[columnIndex] ?? ''
        const parsed = key === 'avgMonthlyRevenue' || key === 'avgDailyBalance'
          ? parseMoneyToken(cell)
          : parseCountToken(cell)
        if (parsed !== null) collected[key].push(parsed)
      })
    }
  }

  return {
    avgMonthlyRevenue: average(collected.avgMonthlyRevenue),
    avgDailyBalance: average(collected.avgDailyBalance),
    depositCount: sum(collected.depositCount),
    nsfCount: sum(collected.nsfCount),
    negativeDays: sum(collected.negativeDays),
    existingPositions: collected.existingPositions.length
      ? collected.existingPositions[collected.existingPositions.length - 1] ?? null
      : null,
  }
}

function extractFromLabels(markdown: string): Partial<StatementMetrics> {
  const result: Partial<StatementMetrics> = {}
  const lines = markdown.split(/\r?\n/)
  for (const line of lines) {
    const normalized = line.replace(/\s+/g, ' ').trim()
    if (!normalized) continue
    for (const [key, patterns] of Object.entries(LABEL_ALIASES) as Array<[MetricKey, RegExp[]]>) {
      if (result[key] !== undefined && result[key] !== null) continue
      const matched = patterns.some((pattern) => pattern.test(normalized))
      if (!matched) continue
      const parsed = key === 'avgMonthlyRevenue' || key === 'avgDailyBalance'
        ? parseMoneyToken(normalized)
        : parseCountToken(normalized)
      if (parsed !== null) result[key] = parsed
    }
  }
  return result
}

export function extractStatementMetrics(markdown: string): StatementMetrics {
  const source = typeof markdown === 'string' ? markdown : ''
  if (!source.trim()) return emptyMetrics()

  const fromTables = extractFromTables(source)
  const fromLabels = extractFromLabels(source)

  return {
    avgMonthlyRevenue: firstDefined(fromLabels.avgMonthlyRevenue, fromTables.avgMonthlyRevenue),
    avgDailyBalance: firstDefined(fromLabels.avgDailyBalance, fromTables.avgDailyBalance),
    depositCount: firstDefined(fromLabels.depositCount, fromTables.depositCount),
    nsfCount: firstDefined(fromLabels.nsfCount, fromTables.nsfCount),
    negativeDays: firstDefined(fromLabels.negativeDays, fromTables.negativeDays),
    existingPositions: firstDefined(fromLabels.existingPositions, fromTables.existingPositions),
  }
}

export function formatMetricMoney(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null
  return value.toFixed(2)
}

export function formatMetricCount(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return Math.round(value)
}
