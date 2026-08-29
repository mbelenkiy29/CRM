import type { SearchModuleConfig } from '@open-mercato/shared/modules/search'

export const searchConfig: SearchModuleConfig = {
  entities: [
    {
      entityId: 'merchant_advances:mca_deal',
      enabled: true,
      aclFeatures: ['merchant_advances.deal.view'],
      fieldPolicy: {
        searchable: ['business_name', 'industry', 'state', 'pipeline_status'],
        hashOnly: ['ein', 'legal_address'],
      },
      resolveUrl: (ctx) => {
        const id = typeof ctx.record.id === 'string' ? ctx.record.id : null
        return id ? `/backend/merchant_advances?id=${id}` : null
      },
    },
    {
      entityId: 'merchant_advances:mca_funder',
      enabled: true,
      aclFeatures: ['merchant_advances.funder.view'],
      fieldPolicy: {
        searchable: ['name', 'code'],
      },
    },
  ],
}

export default searchConfig
