jest.mock('@open-mercato/shared/security/enabledModulesRegistry', () => ({
  hasEnabledModulesRegistry: jest.fn(),
  getEnabledModuleIds: jest.fn(),
}))

import { getEnabledModuleIds, hasEnabledModulesRegistry } from '@open-mercato/shared/security/enabledModulesRegistry'
import { isWebhooksModuleEnabled } from '../webhooksEnabled'

describe('isWebhooksModuleEnabled', () => {
  it('allows intake when the registry is unavailable', () => {
    ;(hasEnabledModulesRegistry as jest.Mock).mockReturnValue(false)
    expect(isWebhooksModuleEnabled()).toBe(true)
  })

  it('returns false when webhooks is not an enabled module', () => {
    ;(hasEnabledModulesRegistry as jest.Mock).mockReturnValue(true)
    ;(getEnabledModuleIds as jest.Mock).mockReturnValue(['auth', 'customers'])
    expect(isWebhooksModuleEnabled()).toBe(false)
  })

  it('returns true when webhooks is enabled', () => {
    ;(hasEnabledModulesRegistry as jest.Mock).mockReturnValue(true)
    ;(getEnabledModuleIds as jest.Mock).mockReturnValue(['webhooks', 'merchant_advances'])
    expect(isWebhooksModuleEnabled()).toBe(true)
  })
})
