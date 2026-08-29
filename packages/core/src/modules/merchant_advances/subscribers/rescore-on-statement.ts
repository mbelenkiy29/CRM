import type { EntityManager } from '@mikro-orm/postgresql'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { refreshFunderMatches } from '../lib/matchRefresh'

const logger = createLogger('merchant_advances')

export const metadata = {
  event: 'merchant_advances.statement.analyzed',
  persistent: true,
  id: 'merchant_advances:rescore-on-statement',
}

export default async function handle(
  payload: unknown,
  ctx: { resolve: <T = unknown>(name: string) => T },
): Promise<void> {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const dealId = typeof data.dealId === 'string' ? data.dealId : null
  const organizationId = typeof data.organizationId === 'string' ? data.organizationId : null
  const tenantId = typeof data.tenantId === 'string' ? data.tenantId : null
  if (!dealId || !organizationId || !tenantId) return
  const em = (ctx.resolve('em') as EntityManager).fork()
  try {
    await refreshFunderMatches(em, { dealId, organizationId, tenantId })
  } catch (error) {
    logger.error('merchant_advances.rescore-on-statement failed', { err: error, dealId })
  }
}
