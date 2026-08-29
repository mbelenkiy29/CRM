import { hasFeature } from '@open-mercato/shared/security/features'
import { REPORTS_VIEW_FEATURE } from '../../reports/aggregates'
import { notificationTypes } from '../../../notifications'
import { setup } from '../../../setup'
import { readEventScope } from '../notifyFeature'

describe('merchant_advances roles and notifications', () => {
  it('grants reports only through the admin wildcard', () => {
    expect(hasFeature(setup.defaultRoleFeatures.admin, REPORTS_VIEW_FEATURE)).toBe(true)
    expect(hasFeature(setup.defaultRoleFeatures.superadmin, REPORTS_VIEW_FEATURE)).toBe(true)
    expect(hasFeature(setup.defaultRoleFeatures.manager, REPORTS_VIEW_FEATURE)).toBe(false)
    expect(hasFeature(setup.defaultRoleFeatures.employee, REPORTS_VIEW_FEATURE)).toBe(false)
    expect(setup.defaultRoleFeatures.manager).toEqual(setup.defaultRoleFeatures.employee)
  })

  it('registers in-app types for offer, decline, stip, submit failure, and renewal', () => {
    const types = notificationTypes.map((row) => row.type)
    expect(types).toEqual(expect.arrayContaining([
      'merchant_advances.offer.created',
      'merchant_advances.reply.decline',
      'merchant_advances.reply.stip_requested',
      'merchant_advances.submission.failed',
      'merchant_advances.renewal.surfaced',
    ]))
  })

  it('reads deal scope from reply payloads', () => {
    expect(readEventScope({
      dealId: '018f1a2b-3c4d-4000-8000-000000000001',
      tenantId: '018f1a2b-3c4d-4000-8000-000000000002',
      organizationId: '018f1a2b-3c4d-4000-8000-000000000003',
      classification: 'decline',
    }).classification).toBe('decline')
  })
})
