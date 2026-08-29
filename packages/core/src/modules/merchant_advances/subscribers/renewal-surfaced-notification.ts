import { createLogger } from '@open-mercato/shared/lib/logger'
import { notifyMerchantAdvancesFeature, readEventScope } from '../lib/notifications/notifyFeature'

const logger = createLogger('merchant_advances')

export const metadata = {
  event: 'merchant_advances.renewal.surfaced',
  persistent: true,
  id: 'merchant_advances:renewal-surfaced-notification',
}

export default async function handle(
  payload: unknown,
  ctx: { resolve: <T = unknown>(name: string) => T },
): Promise<void> {
  const scope = readEventScope(payload)
  if (!scope.tenantId || !scope.dealId) return
  try {
    await notifyMerchantAdvancesFeature(ctx, 'merchant_advances.renewal.surfaced', {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      dealId: scope.dealId,
    })
  } catch (error) {
    logger.error('merchant_advances.renewal-surfaced-notification failed', { err: error })
    throw error
  }
}
