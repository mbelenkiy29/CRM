export type ProtectableDocument = {
  id: string
  attachmentId: string
  classification: string
  isOriginal: boolean
}

export type ProtectedCopyPlan = {
  sourceDocumentId: string
  sourceAttachmentId: string
  stamped: boolean
  stamp: {
    funderName: string
    watermarkEnabled: boolean
    skipped: boolean
  } | null
}

export function planProtectedCopies(input: {
  originals: ProtectableDocument[]
  funderName: string
  skipProtection: boolean
  watermarkEnabled: boolean
}): ProtectedCopyPlan[] {
  return input.originals
    .filter((document) => document.isOriginal)
    .map((document) => ({
      sourceDocumentId: document.id,
      sourceAttachmentId: document.attachmentId,
      stamped: !input.skipProtection,
      stamp: input.skipProtection
        ? null
        : {
            funderName: input.funderName,
            watermarkEnabled: input.watermarkEnabled,
            skipped: false,
          },
    }))
}
