import type { AwilixContainer } from 'awilix'
import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { createSystemCommandContext } from '../commands/statements'
import {
  MCA_ANALYZE_STATEMENTS_QUEUE,
  type AnalyzeStatementJobPayload,
} from '../lib/underwriting/queue'
import type { StatementAnalyzeInput } from '../data/validators'

const logger = createLogger('merchant_advances').child({ component: 'analyze-statements-worker' })

export const metadata: WorkerMeta = {
  queue: MCA_ANALYZE_STATEMENTS_QUEUE,
  id: 'merchant_advances:analyze-statements',
  concurrency: 2,
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
  container?: { resolve<T = unknown>(name: string): T }
}

export default async function handle(
  job: QueuedJob<AnalyzeStatementJobPayload>,
  ctx: JobContext & ResolverContext,
): Promise<void> {
  const payload = job.payload
  if (!payload?.dealId || !payload.tenantId || !payload.organizationId) {
    logger.warn('skipping statement analysis job without scope')
    return
  }

  const container = (ctx.container ?? ctx) as AwilixContainer
  const commandBus = container.resolve('commandBus') as CommandBus
  const input: StatementAnalyzeInput = {
    dealId: payload.dealId,
    attachmentId: payload.attachmentId ?? null,
    documentId: payload.documentId ?? null,
    force: payload.force ?? false,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
  }

  await commandBus.execute<StatementAnalyzeInput, { analysisId: string }>(
    'merchant_advances.statement.analyze',
    {
      input,
      ctx: createSystemCommandContext(container, {
        tenantId: payload.tenantId,
        organizationId: payload.organizationId,
      }),
    },
  )
}
