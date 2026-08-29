import type { McaDocumentClassification } from '../../data/constants'
import { normalizeLabel } from './normalize'

const CLASSIFICATION_KEYWORDS: Array<{ classification: McaDocumentClassification; keywords: string[] }> = [
  { classification: 'statement', keywords: ['statement', 'stmt', 'bank statement', 'deposits', 'bank stmt'] },
  { classification: 'application', keywords: ['application', 'app packet', 'mca app', 'merchant application'] },
  { classification: 'id', keywords: ['driver', 'drivers license', 'license', 'passport', 'id card', 'photo id'] },
  { classification: 'voided_check', keywords: ['voided check', 'void check', 'voided', 'void'] },
  { classification: 'tax_return', keywords: ['tax return', 'tax', '1040', '1120', '1120s'] },
  { classification: 'other_stip', keywords: ['stip', 'stips', 'more stips', 'stipulation', 'packet'] },
]

export function classifyFileName(name: string): McaDocumentClassification {
  const normalized = normalizeLabel(name)
  for (const entry of CLASSIFICATION_KEYWORDS) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry.classification
    }
  }
  return 'other_stip'
}
