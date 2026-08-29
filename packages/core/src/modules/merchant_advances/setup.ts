import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { McaFunder, McaWorkspaceSettings } from './data/entities'

const floorFeatures = [
  'merchant_advances.deal.view',
  'merchant_advances.deal.manage',
  'merchant_advances.funder.view',
  'merchant_advances.offer.view',
  'merchant_advances.offer.manage',
  'merchant_advances.submission.view',
  'merchant_advances.submission.manage',
  'merchant_advances.submission.send',
  'merchant_advances.match.manage',
  'merchant_advances.import.manage',
  'merchant_advances.renewal.view',
]

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['merchant_advances.*'],
    employee: floorFeatures,
  },

  async seedDefaults({ em, tenantId, organizationId }) {
    const existing = await em.findOne(McaWorkspaceSettings, {
      tenantId,
      organizationId,
      deletedAt: null,
    })
    if (!existing) {
      em.persist(em.create(McaWorkspaceSettings, { tenantId, organizationId }))
    }
    await em.flush()
  },

  async seedExamples({ em, tenantId, organizationId }) {
    const count = await em.count(McaFunder, { tenantId, organizationId, deletedAt: null })
    if (count > 0) return
    em.persist(em.create(McaFunder, {
      tenantId,
      organizationId,
      name: 'Northstar Capital',
      code: 'northstar',
      submitMethod: 'email',
      submitEmail: 'submissions@example.com',
      criteria: {
        industries: ['auto repair', 'restaurants'],
        states: ['TX', 'FL'],
        minAvgMonthlyRevenue: 50000,
        minTimeInBusinessMonths: 12,
        maxPosition: 1,
      },
    }))
    em.persist(em.create(McaFunder, {
      tenantId,
      organizationId,
      name: 'Harbor Advance',
      code: 'harbor',
      submitMethod: 'webhook',
      webhookUrl: 'https://example.com/mca-intake',
      criteria: {
        industries: ['auto repair'],
        states: ['TX'],
        minAvgMonthlyRevenue: 40000,
        maxPosition: 2,
      },
    }))
    await em.flush()
  },
}

export default setup
