import type { EntityManager } from '@mikro-orm/postgresql'
import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { McaFunder, McaSubmission } from '../data/entities'

const logger = createLogger('merchant_advances')

type PollPayload = {
  scope?: {
    tenantId?: string | null
    organizationId?: string | null
  }
}

type HandlerContext = JobContext & {
  resolve: <T = unknown>(name: string) => T
}

export const metadata: WorkerMeta = {
  queue: 'merchant_advances.submission_poll',
  id: 'merchant_advances:submission-poll',
  concurrency: 1,
}

export default async function handle(
  job: QueuedJob<PollPayload>,
  ctx: HandlerContext,
): Promise<void> {
  const em = ctx.resolve<EntityManager>('em')
  const tenantId = job.payload?.scope?.tenantId ?? null
  const organizationId = job.payload?.scope?.organizationId ?? null
  const open = await em.find(McaSubmission, {
    ...(tenantId ? { tenantId } : {}),
    ...(organizationId ? { organizationId } : {}),
    status: { $in: ['queued', 'sent', 'draft'] },
    deletedAt: null,
  })
  if (!open.length) return
  const funders = await em.find(McaFunder, {
    id: { $in: open.map((row) => row.funderId) },
    supportsStatusPoll: true,
    deletedAt: null,
  })
  const pollable = new Set(funders.map((funder) => funder.id))
  const now = new Date()
  for (const submission of open) {
    if (!pollable.has(submission.funderId)) continue
    submission.updatedAt = now
  }
  await em.flush()
  logger.info('merchant_advances.submission_poll touched open submissions', { count: open.length })
}
