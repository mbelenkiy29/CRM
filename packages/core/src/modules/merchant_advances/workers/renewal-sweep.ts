import type { EntityManager } from '@mikro-orm/postgresql'
import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { listRenewalSweepScopes, runRenewalSweep, type RenewalSweepScope } from '../lib/renewalSweep'

const logger = createLogger('merchant_advances')

type RenewalSweepPayload = {
  scope?: {
    tenantId?: string | null
    organizationId?: string | null
  }
  now?: string
}

type HandlerContext = JobContext & {
  resolve: <T = unknown>(name: string) => T
}

export const metadata: WorkerMeta = {
  queue: 'merchant_advances.renewal_sweep',
  id: 'merchant_advances:renewal-sweep',
  concurrency: 1,
}

function readScope(payload: RenewalSweepPayload): RenewalSweepScope | null {
  const tenantId = payload.scope?.tenantId?.trim()
  const organizationId = payload.scope?.organizationId?.trim()
  if (!tenantId || !organizationId) return null
  return { tenantId, organizationId }
}

export default async function handle(
  job: QueuedJob<RenewalSweepPayload>,
  ctx: HandlerContext,
): Promise<void> {
  const em = ctx.resolve<EntityManager>('em')
  const scoped = readScope(job.payload ?? {})
  const scopes = scoped ? [scoped] : await listRenewalSweepScopes(em)
  const parsedNow = job.payload?.now ? new Date(job.payload.now) : null
  if (parsedNow && Number.isNaN(parsedNow.getTime())) {
    logger.warn('[merchant_advances:renewal-sweep] invalid now payload, using current time')
  }
  const sweepNow = parsedNow && !Number.isNaN(parsedNow.getTime()) ? parsedNow : new Date()

  for (const scope of scopes) {
    try {
      await runRenewalSweep(em, scope, { now: sweepNow })
    } catch (error) {
      logger.warn('[merchant_advances:renewal-sweep] scope failed', {
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        error: error instanceof Error ? error.message : error,
      })
    }
    em.clear()
  }
}
