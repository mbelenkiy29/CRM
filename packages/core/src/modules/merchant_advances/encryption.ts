import type { ModuleEncryptionMap } from '@open-mercato/shared/modules/encryption'

export const defaultEncryptionMaps: ModuleEncryptionMap[] = [
  {
    entityId: 'merchant_advances:mca_deal',
    fields: [
      { field: 'ein' },
      { field: 'legal_address' },
    ],
  },
  {
    entityId: 'merchant_advances:mca_funder_reply',
    fields: [{ field: 'raw_body' }],
  },
  {
    entityId: 'merchant_advances:mca_statement_analysis',
    fields: [{ field: 'notes' }],
  },
]
