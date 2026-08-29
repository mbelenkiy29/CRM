import type { McaPaymentFrequency, McaReplyClassification } from '../../data/constants'

export type ClassifiedReply = {
  classification: McaReplyClassification
  amount: string | null
  factor: string | null
  termMonths: number | null
  paymentAmount: string | null
  paymentFrequency: McaPaymentFrequency | null
  feesAmount: string | null
  commissionPoints: string | null
  stips: string[]
  declineReason: string | null
}

const DECLINE_RE = /\b(declin(?:e|ed|ing)|denied|not approved|unable to (?:approve|proceed)|unfortunately we cannot|we must pass)\b/i
const OFFER_RE = /\b(approved|approval|offer(?:ed)?|we can fund|terms?:)\b/i
const STIP_RE = /\b(need|please provide|missing|stip(?:s|ulation)?s?|additional documents?)\b/i
const FACTOR_RE = /(?:\bat\b|factor(?:\s+rate)?|x)\s*(\d+\.\d{1,4})\b/i
const TERM_RE = /\b(\d{1,2})\s*months?\b/i
const POINTS_RE = /\b(\d+(?:\.\d{1,4})?)\s*points?\b/i
const FEES_RE = /\bfees?\s+(?:of\s+)?\$?\s*([\d,]+(?:\.\d{1,2})?)/i
const DAILY_RE = /\bdaily\s+\$?\s*([\d,]+(?:\.\d{1,2})?)/i
const WEEKLY_RE = /\bweekly\s+\$?\s*([\d,]+(?:\.\d{1,2})?)/i
const MONTHLY_RE = /\bmonthly\s+\$?\s*([\d,]+(?:\.\d{1,2})?)/i
const DOLLAR_RE = /\$\s*([\d,]+(?:\.\d{1,2})?)/g

function moneyString(raw: string | undefined): string | null {
  if (!raw) return null
  const normalized = raw.replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  return `${whole}.${fraction.padEnd(2, '0').slice(0, 2)}`
}

function factorString(raw: string | undefined): string | null {
  if (!raw) return null
  if (!/^\d+\.\d{1,4}$/.test(raw)) return null
  const [whole, fraction = ''] = raw.split('.')
  return `${whole}.${fraction.padEnd(2, '0')}`
}

function extractStips(text: string): string[] {
  const match = text.match(/(?:need|please provide|missing|stips?:)\s+(.+)/i)
  if (!match?.[1]) return []
  return match[1]
    .split(/\s*(?:,| and |\.|…)\s*/i)
    .map((part) => part.replace(/^[.…]+\s*/, '').trim())
    .filter((part) => part.length > 3 && !/^\d+$/.test(part))
}

export function classifyReply(text: string): ClassifiedReply {
  const body = text.trim()
  const dollars = [...body.matchAll(DOLLAR_RE)].map((row) => moneyString(row[1])).filter((value): value is string => Boolean(value))
  const amount = dollars[0] ?? null
  const factor = factorString(body.match(FACTOR_RE)?.[1])
  const termMonthsRaw = body.match(TERM_RE)?.[1]
  const termMonths = termMonthsRaw ? Number.parseInt(termMonthsRaw, 10) : null
  const daily = moneyString(body.match(DAILY_RE)?.[1])
  const weekly = moneyString(body.match(WEEKLY_RE)?.[1])
  const monthly = moneyString(body.match(MONTHLY_RE)?.[1])
  const paymentAmount = daily ?? weekly ?? monthly
  const paymentFrequency: McaPaymentFrequency | null = daily ? 'daily' : weekly ? 'weekly' : monthly ? 'monthly' : null
  const feesAmount = moneyString(body.match(FEES_RE)?.[1])
  const commissionPoints = body.match(POINTS_RE)?.[1] ?? null
  const stips = extractStips(body)
  const hasTerms = Boolean(amount && (factor || termMonths))
  const declined = DECLINE_RE.test(body)
  const offered = OFFER_RE.test(body) || hasTerms
  const wantsStips = STIP_RE.test(body)

  let classification: McaReplyClassification = 'other'
  if (declined && !hasTerms) classification = 'decline'
  else if (hasTerms || offered) classification = 'offer'
  else if (wantsStips) classification = 'stip_request'

  return {
    classification,
    amount,
    factor,
    termMonths: Number.isInteger(termMonths) ? termMonths : null,
    paymentAmount,
    paymentFrequency,
    feesAmount,
    commissionPoints,
    stips,
    declineReason: classification === 'decline' ? body.slice(0, 500) : null,
  }
}

export function classifiedFromStructured(input: {
  status?: string | null
  amount?: string | number | null
  factor?: string | number | null
  termMonths?: number | null
  paymentAmount?: string | number | null
  paymentFrequency?: McaPaymentFrequency | null
  feesAmount?: string | number | null
  commissionPoints?: string | number | null
  stips?: string[] | null
  declineReason?: string | null
}): ClassifiedReply {
  const status = input.status ?? ''
  const classification: McaReplyClassification =
    status === 'offered' || status === 'accepted' ? 'offer'
      : status === 'declined' ? 'decline'
        : status === 'stips' ? 'stip_request'
          : 'other'
  const amount = input.amount == null || input.amount === '' ? null : moneyString(String(input.amount))
  return {
    classification,
    amount,
    factor: input.factor == null || input.factor === '' ? null : factorString(String(input.factor)) ?? String(input.factor),
    termMonths: input.termMonths ?? null,
    paymentAmount: input.paymentAmount == null || input.paymentAmount === '' ? null : moneyString(String(input.paymentAmount)),
    paymentFrequency: input.paymentFrequency ?? null,
    feesAmount: input.feesAmount == null || input.feesAmount === '' ? null : moneyString(String(input.feesAmount)),
    commissionPoints: input.commissionPoints == null ? null : String(input.commissionPoints),
    stips: input.stips ?? [],
    declineReason: input.declineReason ?? null,
  }
}

export function hasOfferTerms(parsed: ClassifiedReply): boolean {
  return parsed.classification === 'offer' && Boolean(parsed.amount && (parsed.factor || parsed.termMonths))
}
