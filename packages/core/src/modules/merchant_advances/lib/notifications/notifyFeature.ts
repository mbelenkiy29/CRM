import { resolveNotificationService } from '../../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../../notifications'

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export async function notifyMerchantAdvancesFeature(
  ctx: ResolverContext,
  type: string,
  input: {
    tenantId: string
    organizationId: string | null
    dealId: string
    requiredFeature?: string
  },
): Promise<void> {
  const typeDef = notificationTypes.find((row) => row.type === type)
  if (!typeDef) return
  const notificationService = resolveNotificationService(ctx)
  const notificationInput = buildFeatureNotificationFromType(typeDef, {
    requiredFeature: input.requiredFeature ?? 'merchant_advances.deal.view',
    sourceEntityType: 'merchant_advances:mca_deal',
    sourceEntityId: input.dealId,
    linkHref: `/backend/merchant_advances/${input.dealId}`,
  })
  await notificationService.createForFeature(notificationInput, {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
  })
}

export function readEventScope(payload: unknown): {
  tenantId: string | null
  organizationId: string | null
  dealId: string | null
  id: string | null
  classification: string | null
} {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  return {
    tenantId: typeof data.tenantId === 'string' ? data.tenantId : null,
    organizationId: typeof data.organizationId === 'string' ? data.organizationId : null,
    dealId: typeof data.dealId === 'string' ? data.dealId : typeof data.id === 'string' ? data.id : null,
    id: typeof data.id === 'string' ? data.id : null,
    classification: typeof data.classification === 'string' ? data.classification : null,
  }
}
