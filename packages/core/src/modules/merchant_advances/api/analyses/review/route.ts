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
import { statementReviewSchema, type StatementReviewInput } from '../../../data/validators'
import { MCA_ANALYSIS_RESOURCE_KIND } from '../../../commands/shared'
import type { ReviewStatementResult } from '../../../commands/statements'
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
    const input = statementReviewSchema.parse({
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
        resourceId: input.id,
        operation: 'update',
        mutationPayload: { ...input },
      },
    })
    if (!guarded.ok) return guarded.response

    const commandInput = guarded.modifiedPayload
      ? statementReviewSchema.parse({ ...guarded.modifiedPayload, tenantId: context.tenantId, organizationId: context.organizationId })
      : input
    const commandBus = context.ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<StatementReviewInput, ReviewStatementResult>(
      'merchant_advances.statement.review',
      { input: commandInput, ctx: context.ctx },
    )
    await guarded.runAfterSuccess()
    return NextResponse.json({ ok: true, ...result, autoSubmit: false })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    const { translate } = await resolveTranslations()
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: translate('merchant_advances.errors.invalidInput', 'Invalid input') }, { status: 400 })
    }
    logger.error('merchant_advances.analyses.review.post failed', { err })
    return NextResponse.json({ error: translate('merchant_advances.errors.reviewFailed', 'Failed to mark analysis reviewed') }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Mark statement analysis reviewed',
  methods: {
    POST: {
      summary: 'Human underwriter marks a first-pass analysis reviewed. Never submits funders.',
      requestBody: { contentType: 'application/json', schema: statementReviewSchema },
      responses: [
        { status: 200, description: 'Analysis marked reviewed', schema: z.object({ ok: z.boolean(), analysisId: z.string().uuid() }).passthrough() },
      ],
    },
  },
}
