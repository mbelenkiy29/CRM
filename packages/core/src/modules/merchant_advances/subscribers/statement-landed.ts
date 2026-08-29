import { createLogger } from '@open-mercato/shared/lib/logger'
import { enqueueAnalysesForDeal, type ResolverContext } from '../lib/underwriting/enqueueFromEvent'

const logger = createLogger('merchant_advances').child({ component: 'statement-landed' })

export const metadata = {
  event: 'merchant_advances.deal.created',
  persistent: true,
  id: 'merchant_advances:statement-landed',
}

type DealCreatedPayload = {
  id?: unknown
  tenantId?: unknown
  organizationId?: unknown
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export default async function handleDealCreated(payload: DealCreatedPayload, ctx: ResolverContext): Promise<void> {
  const dealId = asString(payload.id)
  const tenantId = asString(payload.tenantId)
  const organizationId = asString(payload.organizationId)
  if (!dealId || !tenantId || !organizationId) return
  try {
    await enqueueAnalysesForDeal({ dealId, tenantId, organizationId }, ctx)
  } catch (error) {
    logger.warn('failed to queue statement analysis after deal create', {
      dealId,
      err: error instanceof Error ? error.message : error,
    })
  }
}
