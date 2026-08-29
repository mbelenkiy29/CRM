export const REPLY_MATCH_WINDOW_MS = 90 * 24 * 60 * 60 * 1000

export type ReplyMatchCandidate = {
  dealId: string
  submissionId: string
  funderId: string
  businessName: string
  funderName: string
  funderCode?: string | null
  submitEmail?: string | null
  funderReference?: string | null
  updatedAt: Date
}

export type InboundMatchHints = {
  dealId?: string | null
  funderId?: string | null
  funderReference?: string | null
  from?: string | null
  to?: string | null
  subject?: string | null
  body?: string | null
  now?: Date
}

export type ReplyMatch = {
  dealId: string
  submissionId: string
  funderId: string
}

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function includesName(haystack: string, needle: string): boolean {
  if (!needle || needle.length < 3) return false
  return haystack.includes(needle)
}

export function matchInboundReply(
  hints: InboundMatchHints,
  candidates: ReplyMatchCandidate[],
): ReplyMatch | null {
  const now = hints.now ?? new Date()
  const subject = normalize(hints.subject)
  const body = normalize(hints.body)
  const haystack = `${subject} ${body}`
  const from = normalize(hints.from)
  const reference = normalize(hints.funderReference)

  const scored = candidates
    .filter((row) => now.getTime() - row.updatedAt.getTime() <= REPLY_MATCH_WINDOW_MS)
    .map((row) => {
      let score = 0
      if (hints.dealId && row.dealId === hints.dealId) score += 100
      if (hints.funderId && row.funderId === hints.funderId) score += 40
      if (reference && normalize(row.funderReference) === reference) score += 80
      if (from && normalize(row.submitEmail) === from) score += 50
      if (from && includesName(from, normalize(row.funderName))) score += 25
      if (from && row.funderCode && includesName(from, normalize(row.funderCode))) score += 20
      if (includesName(haystack, normalize(row.businessName))) score += 30
      if (includesName(haystack, normalize(row.funderName))) score += 10
      if (hints.dealId && row.dealId !== hints.dealId && score < 100) return { row, score: 0 }
      return { row, score }
    })
    .filter((entry) => entry.score >= 30)
    .sort((left, right) => right.score - left.score || right.row.updatedAt.getTime() - left.row.updatedAt.getTime())

  const winner = scored[0]?.row
  if (!winner) return null
  return {
    dealId: winner.dealId,
    submissionId: winner.submissionId,
    funderId: winner.funderId,
  }
}
