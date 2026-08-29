import { trimCell } from './normalize'
import type { ApplicationPdfFields } from './types'

const EIN_PATTERN = /\b(\d{2}-\d{7})\b/
const MONEY_PATTERN = /\$?\s*([\d,]+(?:\.\d{2})?)/
const STATE_PATTERN = /\b([A-Z]{2})\b/
const ADDRESS_PATTERN = /(\d{1,6}\s+[A-Za-z0-9.'# -]+(?:street|st|avenue|ave|road|rd|drive|dr|blvd|boulevard|lane|ln|way|suite|ste|unit)\.?[^,\n]*,\s*[A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/i

function firstCapture(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern)
  return match?.[1] ? match[1].trim() : null
}

function labeledValue(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:\\-]?\\s*([^\\n]+)`, 'i')
    const value = firstCapture(text, pattern)
    if (value) return trimCell(value)
  }
  return null
}

export function extractApplicationFields(pdfText: string): ApplicationPdfFields {
  const ein = firstCapture(pdfText, EIN_PATTERN)
  const businessName = labeledValue(pdfText, [
    'legal name',
    'business name',
    'dba',
    'merchant name',
    'company name',
  ])
  const requestedRaw = labeledValue(pdfText, ['requested amount', 'amount requested', 'funding requested'])
  const revenueRaw = labeledValue(pdfText, ['average monthly revenue', 'avg monthly revenue', 'monthly revenue'])
  const address = firstCapture(pdfText, ADDRESS_PATTERN)
    ?? labeledValue(pdfText, ['legal address', 'business address', 'address'])
  const stateFromAddress = address ? firstCapture(address, STATE_PATTERN) : null
  const state = labeledValue(pdfText, ['state']) ?? stateFromAddress
  const tibRaw = labeledValue(pdfText, ['time in business', 'months in business'])
  const tibMonths = tibRaw ? Number.parseInt(tibRaw.replace(/[^\d]/g, ''), 10) : Number.NaN

  return {
    businessName,
    ein,
    legalAddress: address,
    state,
    requestedAmount: requestedRaw ? firstCapture(requestedRaw, MONEY_PATTERN) ?? requestedRaw : null,
    avgMonthlyRevenue: revenueRaw ? firstCapture(revenueRaw, MONEY_PATTERN) ?? revenueRaw : null,
    timeInBusinessMonths: Number.isFinite(tibMonths) ? tibMonths : null,
  }
}

export function fillMissingFieldsFromPdf<T extends Record<string, string | number | null>>(
  sheetFields: T,
  pdfFields: ApplicationPdfFields,
): { fields: T; pdfFilledFields: string[] } {
  const fields = { ...sheetFields }
  const pdfFilledFields: string[] = []
  const keys = Object.keys(pdfFields) as Array<keyof ApplicationPdfFields>
  for (const key of keys) {
    const pdfValue = pdfFields[key]
    if (pdfValue === null || pdfValue === undefined || pdfValue === '') continue
    const current = fields[key as keyof T]
    if (current === null || current === undefined || current === '') {
      fields[key as keyof T] = pdfValue as T[keyof T]
      pdfFilledFields.push(String(key))
    }
  }
  return { fields, pdfFilledFields }
}
