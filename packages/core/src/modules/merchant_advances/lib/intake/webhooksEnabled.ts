import {
  getEnabledModuleIds,
  hasEnabledModulesRegistry,
} from '@open-mercato/shared/security/enabledModulesRegistry'

export function isWebhooksModuleEnabled(): boolean {
  if (!hasEnabledModulesRegistry()) return true
  return getEnabledModuleIds().includes('webhooks')
}
