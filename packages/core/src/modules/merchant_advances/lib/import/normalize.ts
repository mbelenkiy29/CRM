export function trimCell(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeLabel(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeBusinessName(value: string): string {
  return normalizeLabel(value)
    .replace(/&/g, ' and ')
    .replace(/\b(llc|inc|ltd|corp|co|limited|incorporated|company|dba)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function folderStem(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/').filter((part) => part.length > 0)
  if (parts.length >= 2) return parts[parts.length - 2] ?? path
  const fileName = parts[parts.length - 1] ?? path
  return fileName.replace(/\.[a-z0-9]+$/i, '')
}

export function levenshtein(left: string, right: string): number {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 0; i < left.length; i += 1) {
    const current = [i + 1]
    for (let j = 0; j < right.length; j += 1) {
      const insertCost = (current[j] ?? 0) + 1
      const deleteCost = (previous[j + 1] ?? 0) + 1
      const substituteCost = (previous[j] ?? 0) + (left[i] === right[j] ? 0 : 1)
      current[j + 1] = Math.min(insertCost, deleteCost, substituteCost)
    }
    for (let j = 0; j < previous.length; j += 1) {
      previous[j] = current[j] ?? 0
    }
  }
  return previous[right.length] ?? Math.max(left.length, right.length)
}

export function similarity(left: string, right: string): number {
  const a = normalizeBusinessName(left)
  const b = normalizeBusinessName(right)
  if (!a || !b) return 0
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 0
  return 1 - levenshtein(a, b) / maxLen
}

const SSN_HEADER_TOKENS = [
  'ssn',
  'social security',
  'social security number',
  'social security no',
  'ssn last 4',
  'itin',
]

export function isSensitiveHeader(header: string): boolean {
  const normalized = normalizeLabel(header)
  return SSN_HEADER_TOKENS.some((token) => normalized === token || normalized.includes(token))
}

export function looksLikeSsn(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 9) return false
  return /^\d{3}-?\d{2}-?\d{4}$/.test(value.trim())
}
