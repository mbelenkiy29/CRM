import type { EntityManager } from '@mikro-orm/postgresql'
import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { ingestInboundReply, type InboundReplyInput } from '../lib/replies/ingest'

const logger = createLogger('merchant_advances')

type ParsePayload = InboundReplyInput & {
  scope?: {
    tenantId?: string | null
    organizationId?: string | null
  }
}

type HandlerContext = JobContext & {
  resolve: <T = unknown>(name: string) => T
}

export const metadata: WorkerMeta = {
  queue: 'merchant_advances.reply_parse',
  id: 'merchant_advances:parse-funder-reply',
  concurrency: 2,
}

export default async function handle(
  job: QueuedJob<ParsePayload>,
  ctx: HandlerContext,
): Promise<void> {
  const organizationId = job.payload.organizationId ?? job.payload.scope?.organizationId ?? null
  const tenantId = job.payload.tenantId ?? job.payload.scope?.tenantId ?? null
  if (!organizationId || !tenantId) return
  const em = ctx.resolve<EntityManager>('em')
  const result = await ingestInboundReply(em, {
    ...job.payload,
    organizationId,
    tenantId,
  })
  if (result.unmatched) {
    logger.info('merchant_advances.reply_parse unmatched inbound', { from: job.payload.from })
    return
  }
  logger.info('merchant_advances.reply_parse ingested', {
    replyId: result.replyId,
    classification: result.classification,
  })
}
