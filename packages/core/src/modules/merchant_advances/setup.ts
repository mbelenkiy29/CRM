import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { McaFunder, McaWorkspaceSettings } from './data/entities'
import { SEEDED_FUNDER_CRITERIA } from './lib/seedFunders'

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
    superadmin: ['merchant_advances.*'],
    admin: ['merchant_advances.*'],
    manager: floorFeatures,
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
    const seeded = await em.find(McaFunder, {
      tenantId,
      organizationId,
      code: { $in: Object.keys(SEEDED_FUNDER_CRITERIA) },
      deletedAt: null,
    })
    for (const funder of seeded) {
      const defaults = funder.code ? SEEDED_FUNDER_CRITERIA[funder.code] : null
      if (!defaults) continue
      funder.criteria = { ...defaults, ...(funder.criteria ?? {}) }
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
      criteria: SEEDED_FUNDER_CRITERIA.northstar,
    }))
    em.persist(em.create(McaFunder, {
      tenantId,
      organizationId,
      name: 'Harbor Advance',
      code: 'harbor',
      submitMethod: 'webhook',
      webhookUrl: 'https://example.com/mca-intake',
      criteria: SEEDED_FUNDER_CRITERIA.harbor,
    }))
    await em.flush()
  },
}

export default setup
