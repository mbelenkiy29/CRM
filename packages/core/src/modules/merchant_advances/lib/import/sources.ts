import type { ImportFileRef } from './types'

export type ZipLeadPackage = {
  spreadsheetText: string
  filename: string
  files: ImportFileRef[]
}

export function parseZipLeadPackage(_bytes: Uint8Array): ZipLeadPackage {
  // TODO: unzip lead packages (≤ ~1000 leads), locate the spreadsheet, and list document folders.
  throw new Error('[internal] zip lead-package parsing is not implemented yet')
}

export async function importFromGoogleDrive(_args: {
  folderId: string
  credentials?: Record<string, unknown>
}): Promise<ZipLeadPackage> {
  // TODO: list Drive folder files behind integration credentials (cap ~5000 files).
  throw new Error('[internal] Google Drive import is not implemented yet')
}

export async function ingestForwardedLeadEmail(_args: {
  rawMessage: string
  intakeAddress: string
}): Promise<{ spreadsheetText: string | null; files: ImportFileRef[] }> {
  // TODO: parse a forwarded lead via tryResolve(channel_imap / channel_gmail), assign, and reply with the deal link.
  throw new Error('[internal] private intake email parsing is not implemented yet')
}
