import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { ProgressService } from '../../progress/lib/progressService'
import { emitMerchantAdvancesEvent } from '../events'
import { commitReviewedImportWithOrm } from '../lib/import/ormPersistence'
import {
  MCA_IMPORT_COMMIT_QUEUE,
  type McaImportCommitJobPayload,
} from '../lib/import/queue'
import type { ColumnMap, ImportPreviewRow } from '../lib/import/types'
import type { McaAssignmentMethod, McaImportSource } from '../data/constants'

const logger = createLogger('merchant_advances')

export const metadata: WorkerMeta = {
  queue: MCA_IMPORT_COMMIT_QUEUE,
  id: 'merchant_advances:import-commit',
  concurrency: 1,
}

export default async function handle(
  job: QueuedJob<McaImportCommitJobPayload>,
  _ctx: JobContext,
): Promise<void> {
  const container = await createRequestContainer()
  const progressService = container.resolve('progressService') as ProgressService
  const progressContext = {
    tenantId: job.payload.scope.tenantId,
    organizationId: job.payload.scope.organizationId,
    userId: job.payload.scope.userId,
  }

  try {
    await progressService.startJob(job.payload.progressJobId, progressContext)
    const em = (container.resolve('em') as EntityManager).fork()
    const result = await commitReviewedImportWithOrm(em, {
      organizationId: job.payload.scope.organizationId,
      tenantId: job.payload.scope.tenantId,
    }, {
      source: job.payload.source as McaImportSource,
      rows: job.payload.rows as ImportPreviewRow[],
      columnMap: job.payload.columnMap as ColumnMap,
      assignmentMethod: job.payload.assignmentMethod as McaAssignmentMethod,
      leadSourceId: job.payload.leadSourceId,
      leadSourceName: job.payload.leadSourceName,
      leadBatchName: job.payload.leadBatchName,
      saveMappingAs: job.payload.saveMappingAs,
      roundRobinCursorUserId: job.payload.roundRobinCursorUserId,
    })
    await progressService.updateProgress(
      job.payload.progressJobId,
      { processedCount: result.dealCount, totalCount: result.dealCount },
      progressContext,
    )
    await progressService.completeJob(
      job.payload.progressJobId,
      {
        resultSummary: {
          importJobId: result.importJobId,
          resultsCsv: result.resultsCsv,
          dealIds: result.deals.map((deal) => deal.dealId),
          dealCount: result.dealCount,
        },
      },
      progressContext,
    )
    await emitMerchantAdvancesEvent('merchant_advances.import.completed', {
      importJobId: result.importJobId,
      dealCount: result.dealCount,
      failureCount: result.failureCount,
    }, {
      tenantId: job.payload.scope.tenantId,
      organizationId: job.payload.scope.organizationId,
    })
  } catch (error) {
    logger.error('Import commit worker failed', { err: error })
    await progressService.failJob(
      job.payload.progressJobId,
      {
        errorMessage: error instanceof Error ? error.message : '[internal] import commit worker failed',
      },
      progressContext,
    )
    throw error
  }
}
