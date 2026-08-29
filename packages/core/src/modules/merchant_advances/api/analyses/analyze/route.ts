import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { statementAnalyzeSchema, type StatementAnalyzeInput } from '../../../data/validators'
import { MCA_ANALYSIS_RESOURCE_KIND } from '../../../commands/shared'
import type { AnalyzeStatementResult } from '../../../commands/statements'
import { enqueueStatementAnalysis } from '../../../lib/underwriting/queue'
import { resolveMerchantAdvancesRouteContext, toRecord } from '../../routeContext'

const logger = createLogger('merchant_advances')

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.deal.manage'] },
}

export async function POST(req: Request) {
  try {
    const context = await resolveMerchantAdvancesRouteContext(req)
    const payload = toRecord(await readJsonSafe(req, {}))
    const scopedPayload = withScopedPayload(payload, context.ctx, context.translate)
    const input = statementAnalyzeSchema.parse({
      ...scopedPayload,
      tenantId: context.tenantId,
      organizationId: context.organizationId,
    })
    const userId = context.ctx.auth?.sub
    if (!userId) {
      throw new CrudHttpError(401, { error: context.translate('merchant_advances.errors.unauthorized', 'Unauthorized') })
    }
    const guarded = await runRouteMutationGuards({
      container: context.ctx.container,
      req,
      auth: { userId, tenantId: context.tenantId, organizationId: context.organizationId },
      input: {
        resourceKind: MCA_ANALYSIS_RESOURCE_KIND,
        resourceId: input.dealId,
        operation: 'update',
        mutationPayload: { ...input },
      },
    })
    if (!guarded.ok) return guarded.response

    const commandInput = guarded.modifiedPayload
      ? statementAnalyzeSchema.parse({ ...guarded.modifiedPayload, tenantId: context.tenantId, organizationId: context.organizationId })
      : input

    if (commandInput.markdown) {
      const commandBus = context.ctx.container.resolve('commandBus') as CommandBus
      const { result } = await commandBus.execute<StatementAnalyzeInput, AnalyzeStatementResult>(
        'merchant_advances.statement.analyze',
        { input: commandInput, ctx: context.ctx },
      )
      await guarded.runAfterSuccess()
      return NextResponse.json({ ok: true, queued: false, ...result })
    }

    await enqueueStatementAnalysis({
      dealId: commandInput.dealId,
      attachmentId: commandInput.attachmentId ?? null,
      documentId: commandInput.documentId ?? null,
      force: commandInput.force ?? true,
      tenantId: context.tenantId,
      organizationId: context.organizationId,
    })
    await guarded.runAfterSuccess()
    return NextResponse.json({ ok: true, queued: true, dealId: commandInput.dealId, humanReviewRequired: true, autoSubmit: false })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    const { translate } = await resolveTranslations()
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: translate('merchant_advances.errors.invalidInput', 'Invalid input') }, { status: 400 })
    }
    logger.error('merchant_advances.analyses.analyze.post failed', { err })
    return NextResponse.json({ error: translate('merchant_advances.errors.analyzeFailed', 'Failed to analyze statement') }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Analyze bank statement',
  methods: {
    POST: {
      summary: 'Queues or runs first-pass statement analysis. Never auto-submits funders.',
      requestBody: { contentType: 'application/json', schema: statementAnalyzeSchema },
      responses: [
        { status: 200, description: 'Analysis queued or written', schema: z.object({ ok: z.boolean(), queued: z.boolean() }).passthrough() },
      ],
    },
  },
}
