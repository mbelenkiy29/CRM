import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'

export const MCA_DEAL_RESOURCE_KIND = 'merchant_advances.deal'
export const MCA_ANALYSIS_RESOURCE_KIND = 'merchant_advances.statement_analysis'

export type MerchantAdvancesScope = {
  tenantId: string
  organizationId: string
}

export function resolveCommandScope(
  ctx: CommandRuntimeContext,
  input: { tenantId?: string | null; organizationId?: string | null },
): MerchantAdvancesScope {
  const tenantId = input.tenantId ?? ctx.auth?.tenantId ?? null
  const organizationId = input.organizationId ?? ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!tenantId || !organizationId) {
    throw new CrudHttpError(400, { error: '[internal] merchant advances scope is missing' })
  }
  return { tenantId, organizationId }
}
