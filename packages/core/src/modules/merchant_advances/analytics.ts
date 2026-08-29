import type { AnalyticsModuleConfig } from '@open-mercato/shared/modules/analytics'

export const analyticsConfig: AnalyticsModuleConfig = {
  entities: [
    {
      entityId: 'merchant_advances:mca_deal',
      requiredFeatures: ['merchant_advances.deal.view'],
      entityConfig: {
        tableName: 'mca_deals',
        dateField: 'created_at',
        defaultScopeFields: ['tenant_id', 'organization_id'],
      },
      fieldMappings: {
        id: { dbColumn: 'id', type: 'uuid' },
        pipelineStatus: { dbColumn: 'pipeline_status', type: 'text' },
        requestedAmount: { dbColumn: 'requested_amount', type: 'numeric' },
        createdAt: { dbColumn: 'created_at', type: 'timestamp' },
        ownerUserId: { dbColumn: 'owner_user_id', type: 'uuid' },
      },
    },
  ],
}

export default analyticsConfig
