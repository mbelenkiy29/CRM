import { parseCommaSeparatedList } from '@open-mercato/shared/lib/string'

export const CRITERIA_LIST_KEYS = [
  'industries',
  'excludedIndustries',
  'states',
  'preferredIndustries',
  'entityTypes',
  'excludedSic',
  'useOfFunds',
] as const

export type CriteriaListKey = (typeof CRITERIA_LIST_KEYS)[number]

export function isCriteriaListKey(key: string): key is CriteriaListKey {
  return (CRITERIA_LIST_KEYS as readonly string[]).includes(key)
}

export function parseCriteriaListTokens(raw: string): string[] {
  return parseCommaSeparatedList(raw)
}

export function mergeCriteriaListTokens(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((token) => token.toLowerCase()))
  const next = [...existing]
  for (const token of incoming) {
    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(token)
  }
  return next
}

export function splitCriteriaListCommaDraft(raw: string): { complete: string[]; draft: string } {
  if (!raw.includes(',')) {
    return { complete: [], draft: raw }
  }
  const parts = raw.split(',')
  const trailing = parts.pop() ?? ''
  return {
    complete: parseCriteriaListTokens(parts.join(',')),
    draft: trailing.replace(/^\s+/, ''),
  }
}
