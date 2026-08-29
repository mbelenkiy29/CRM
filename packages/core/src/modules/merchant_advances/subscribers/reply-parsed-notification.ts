import { createLogger } from '@open-mercato/shared/lib/logger'
import { notifyMerchantAdvancesFeature, readEventScope } from '../lib/notifications/notifyFeature'

const logger = createLogger('merchant_advances')

export const metadata = {
  event: 'merchant_advances.reply.parsed',
  persistent: true,
  id: 'merchant_advances:reply-parsed-notification',
}

export default async function handle(
  payload: unknown,
  ctx: { resolve: <T = unknown>(name: string) => T },
): Promise<void> {
  const scope = readEventScope(payload)
  if (!scope.tenantId || !scope.dealId) return
  const type = scope.classification === 'decline'
    ? 'merchant_advances.reply.decline'
    : scope.classification === 'stip_request'
      ? 'merchant_advances.reply.stip_requested'
      : null
  if (!type) return
  try {
    await notifyMerchantAdvancesFeature(ctx, type, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      dealId: scope.dealId,
    })
  } catch (error) {
    logger.error('merchant_advances.reply-parsed-notification failed', { err: error })
    throw error
  }
}
