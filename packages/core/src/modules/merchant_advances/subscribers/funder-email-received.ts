import type { EntityManager } from '@mikro-orm/postgresql'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { ingestInboundReply } from '../lib/replies/ingest'

const logger = createLogger('merchant_advances')

export const metadata = {
  event: 'merchant_advances.reply.inbound_received',
  persistent: true,
  id: 'merchant_advances:funder-email-received',
}

export default async function handle(
  payload: unknown,
  ctx: { resolve: <T = unknown>(name: string) => T },
): Promise<void> {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const organizationId = typeof data.organizationId === 'string' ? data.organizationId : null
  const tenantId = typeof data.tenantId === 'string' ? data.tenantId : null
  const body = typeof data.body === 'string' ? data.body : null
  if (!organizationId || !tenantId || !body) return
  const em = (ctx.resolve('em') as EntityManager).fork()
  try {
    await ingestInboundReply(em, {
      organizationId,
      tenantId,
      body,
      subject: typeof data.subject === 'string' ? data.subject : null,
      from: typeof data.from === 'string' ? data.from : null,
      to: typeof data.to === 'string' ? data.to : null,
      dealId: typeof data.dealId === 'string' ? data.dealId : null,
      funderId: typeof data.funderId === 'string' ? data.funderId : null,
      funderReference: typeof data.funderReference === 'string' ? data.funderReference : null,
      source: 'email',
    })
  } catch (error) {
    logger.error('merchant_advances.funder-email-received failed', { err: error })
    throw error
  }
}
