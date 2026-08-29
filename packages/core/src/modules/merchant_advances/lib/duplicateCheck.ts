export type ExistingSubmission = {
  dealId: string
  funderId: string
  status: string
  deletedAt?: Date | null
}

const BLOCKING_STATUSES = new Set(['draft', 'queued', 'sent', 'accepted', 'offered', 'stips'])

export function findDuplicateSubmission(
  existing: ExistingSubmission[],
  dealId: string,
  funderId: string,
): ExistingSubmission | null {
  return (
    existing.find(
      (row) =>
        row.dealId === dealId &&
        row.funderId === funderId &&
        !row.deletedAt &&
        BLOCKING_STATUSES.has(row.status),
    ) ?? null
  )
}

export function assertUniqueSubmission(
  existing: ExistingSubmission[],
  dealId: string,
  funderId: string,
): void {
  const duplicate = findDuplicateSubmission(existing, dealId, funderId)
  if (duplicate) {
    throw new Error('[internal] duplicate submission to the same funder on this deal')
  }
}
