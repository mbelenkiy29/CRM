export type ExistingSubmission = {
  dealId: string
  funderId: string
  status: string
  deletedAt?: Date | null
  merchantKey?: string | null
}

const BLOCKING_STATUSES = new Set(['draft', 'queued', 'sent', 'accepted', 'offered', 'stips'])

export const DUPLICATE_SUBMISSION_CODE = 'duplicate_funder_submission'

export function merchantIdentityKey(input: {
  ein?: string | null
  businessName?: string | null
  state?: string | null
}): string | null {
  const ein = input.ein?.replace(/\D/g, '') ?? ''
  if (ein.length >= 7) return `ein:${ein}`
  const name = input.businessName?.trim().toLowerCase() ?? ''
  const state = input.state?.trim().toUpperCase() ?? ''
  if (!name) return null
  return `name:${name}|${state}`
}

export function findDuplicateSubmission(
  existing: ExistingSubmission[],
  dealId: string,
  funderId: string,
  merchantKey?: string | null,
): ExistingSubmission | null {
  return (
    existing.find((row) => {
      if (row.funderId !== funderId || row.deletedAt || !BLOCKING_STATUSES.has(row.status)) return false
      if (row.dealId === dealId) return true
      return Boolean(merchantKey && row.merchantKey && row.merchantKey === merchantKey)
    }) ?? null
  )
}

export function assertUniqueSubmission(
  existing: ExistingSubmission[],
  dealId: string,
  funderId: string,
  merchantKey?: string | null,
): void {
  const duplicate = findDuplicateSubmission(existing, dealId, funderId, merchantKey)
  if (duplicate) {
    throw new Error('[internal] duplicate submission to the same funder on this deal')
  }
}
