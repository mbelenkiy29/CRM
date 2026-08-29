import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { ProgressService } from '@open-mercato/core/modules/progress/lib/progressService'
import { importCommitRequestSchema } from '../../../data/validators'
import { emitMerchantAdvancesEvent } from '../../../events'
import { commitReviewedImportWithOrm } from '../../../lib/import/ormPersistence'
import { getMerchantAdvancesQueue, MCA_IMPORT_COMMIT_QUEUE } from '../../../lib/import/queue'
import type { ImportPreviewRow } from '../../../lib/import/types'
import { resolveImportRequestContext, runImportGuardAfterSuccess, runImportGuards } from '../../importGuards'

const logger = createLogger('merchant_advances')

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.import.manage'] },
}

export async function POST(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    const requestContext = await resolveImportRequestContext(req)
    const payload = await req.json().catch(() => ({}))
    const input = importCommitRequestSchema.parse(payload)
    const readyCount = input.rows.filter((row) => row.status === 'ready').length
    if (readyCount === 0) {
      return Response.json(
        { error: translate('merchant_advances.imports.errors.nothingToCreate', 'Review the file: no ready rows to create.') },
        { status: 400 },
      )
    }

    const guardResult = await runImportGuards(requestContext.ctx, {
      tenantId: requestContext.tenantId,
      organizationId: requestContext.organizationId,
      userId: requestContext.ctx.auth?.sub ?? '',
      resourceKind: 'merchant_advances.deal',
      resourceId: null,
      operation: 'create',
      requestMethod: req.method,
      requestHeaders: req.headers,
      mutationPayload: {
        dealCount: readyCount,
        assignmentMethod: input.assignmentMethod,
      },
    })
    if (!guardResult.ok) {
      return Response.json(
        guardResult.errorBody ?? { error: translate('merchant_advances.errors.operationBlocked', 'Operation blocked by guard') },
        { status: guardResult.errorStatus ?? 422 },
      )
    }

    const progressService = requestContext.ctx.container.resolve('progressService') as ProgressService
    const progressJob = await progressService.createJob(
      {
        jobType: 'merchant_advances.imports.commit',
        name: translate('merchant_advances.imports.progress.name', 'Import MCA lead package'),
        description: translate(
          'merchant_advances.imports.progress.description',
          '{count} deals queued for create after review',
          { count: readyCount },
        ),
        totalCount: readyCount,
        cancellable: false,
        meta: {
          source: input.source,
          assignmentMethod: input.assignmentMethod,
        },
      },
      {
        tenantId: requestContext.tenantId,
        organizationId: requestContext.organizationId,
        userId: requestContext.ctx.auth?.sub,
      },
    )

    const progressContext = {
      tenantId: requestContext.tenantId,
      organizationId: requestContext.organizationId,
      userId: requestContext.ctx.auth?.sub,
    }

    const runInline = process.env.MCA_IMPORT_SYNC === '1' || input.rows.length <= 50
    if (runInline) {
      await progressService.startJob(progressJob.id, progressContext)
      const em = (requestContext.ctx.container.resolve('em') as EntityManager).fork()
      const result = await commitReviewedImportWithOrm(em, {
        organizationId: requestContext.organizationId,
        tenantId: requestContext.tenantId,
      }, {
        source: input.source,
        rows: input.rows as ImportPreviewRow[],
        columnMap: input.columnMap,
        assignmentMethod: input.assignmentMethod,
        leadSourceId: input.leadSourceId,
        leadSourceName: input.leadSourceName,
        leadBatchName: input.leadBatchName,
        saveMappingAs: input.saveMappingAs,
        roundRobinCursorUserId: input.roundRobinCursorUserId,
      })
      await progressService.updateProgress(
        progressJob.id,
        { processedCount: result.dealCount, totalCount: result.dealCount },
        progressContext,
      )
      await progressService.completeJob(
        progressJob.id,
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
        tenantId: requestContext.tenantId,
        organizationId: requestContext.organizationId,
      })
      if (guardResult.afterSuccessCallbacks.length) {
        await runImportGuardAfterSuccess(guardResult.afterSuccessCallbacks, {
          tenantId: requestContext.tenantId,
          organizationId: requestContext.organizationId,
          userId: requestContext.ctx.auth?.sub ?? '',
          resourceKind: 'merchant_advances.deal',
          resourceId: result.importJobId,
          operation: 'create',
          requestMethod: req.method,
          requestHeaders: req.headers,
        })
      }
      return Response.json({
        ok: true,
        progressJobId: progressJob.id,
        importJobId: result.importJobId,
        dealCount: result.dealCount,
        failureCount: result.failureCount,
        resultsCsv: result.resultsCsv,
        dealIds: result.deals.map((deal) => deal.dealId),
      }, { status: 200 })
    }

    const queue = getMerchantAdvancesQueue(MCA_IMPORT_COMMIT_QUEUE)
    try {
      await queue.enqueue({
        progressJobId: progressJob.id,
        source: input.source,
        rows: input.rows,
        columnMap: input.columnMap,
        assignmentMethod: input.assignmentMethod,
        leadSourceId: input.leadSourceId,
        leadSourceName: input.leadSourceName,
        leadBatchName: input.leadBatchName,
        saveMappingAs: input.saveMappingAs,
        roundRobinCursorUserId: input.roundRobinCursorUserId,
        scope: {
          organizationId: requestContext.organizationId,
          tenantId: requestContext.tenantId,
          userId: requestContext.ctx.auth?.sub,
        },
      })
    } catch (error) {
      await progressService.failJob(
        progressJob.id,
        {
          errorMessage: error instanceof Error ? error.message : translate('merchant_advances.imports.errors.commitFailed', 'Failed to enqueue import'),
        },
        progressContext,
      )
      throw error
    }

    if (guardResult.afterSuccessCallbacks.length) {
      await runImportGuardAfterSuccess(guardResult.afterSuccessCallbacks, {
        tenantId: requestContext.tenantId,
        organizationId: requestContext.organizationId,
        userId: requestContext.ctx.auth?.sub ?? '',
        resourceKind: 'merchant_advances.deal',
        resourceId: progressJob.id,
        operation: 'create',
        requestMethod: req.method,
        requestHeaders: req.headers,
      })
    }

    return Response.json({
      ok: true,
      progressJobId: progressJob.id,
      importJobId: null,
      dealCount: readyCount,
      failureCount: input.rows.length - readyCount,
      resultsCsv: null,
      dealIds: [],
    }, { status: 202 })
  } catch (error) {
    if (isCrudHttpError(error)) {
      return Response.json(error.body, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: translate('merchant_advances.imports.errors.invalidPayload', 'Invalid import commit payload') },
        { status: 400 },
      )
    }
    logger.error('Import commit failed', { err: error })
    return Response.json(
      { error: translate('merchant_advances.imports.errors.commitFailed', 'Could not create deals from the reviewed import') },
      { status: 500 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Commit a reviewed MCA lead-package import',
  methods: {
    POST: {
      summary: 'Commit import',
      requestBody: {
        contentType: 'application/json',
        schema: importCommitRequestSchema,
      },
      responses: [
        { status: 200, description: 'Import completed inline' },
        { status: 202, description: 'Import queued' },
        { status: 400, description: 'Nothing to create' },
        { status: 401, description: 'Unauthorized' },
      ],
    },
  },
}
