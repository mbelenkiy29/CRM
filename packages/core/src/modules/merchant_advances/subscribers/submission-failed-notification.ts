import { createLogger } from '@open-mercato/shared/lib/logger'
import { notifyMerchantAdvancesFeature, readEventScope } from '../lib/notifications/notifyFeature'

const logger = createLogger('merchant_advances')

export const metadata = {
  event: 'merchant_advances.submission.failed',
  persistent: true,
  id: 'merchant_advances:submission-failed-notification',
}

export default async function handle(
  payload: unknown,
  ctx: { resolve: <T = unknown>(name: string) => T },
): Promise<void> {
  const scope = readEventScope(payload)
  if (!scope.tenantId || !scope.dealId) return
  try {
    await notifyMerchantAdvancesFeature(ctx, 'merchant_advances.submission.failed', {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      dealId: scope.dealId,
    })
  } catch (error) {
    logger.error('merchant_advances.submission-failed-notification failed', { err: error })
    throw error
  }
}
