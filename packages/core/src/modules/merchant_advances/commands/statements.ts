import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand, type CommandHandler, type CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { McaDeal, McaDocument, McaStatementAnalysis } from '../data/entities'
import {
  statementAnalyzeSchema,
  statementReviewSchema,
  type StatementAnalyzeInput,
  type StatementReviewInput,
} from '../data/validators'
import { emitMerchantAdvancesEvent } from '../events'
import { combineDealAttributes, resolveDealFieldFill } from '../lib/underwriting/applyDealFill'
import { extractStatementWithOptionalAi } from '../lib/underwriting/aiExtract'
import { formatMetricCount, formatMetricMoney } from '../lib/underwriting/extractStatement'
import { canTransition } from '../lib/pipeline'
import { MCA_ANALYSIS_RESOURCE_KIND, resolveCommandScope } from './shared'

const logger = createLogger('merchant_advances').child({ component: 'statement-command' })

export type AnalyzeStatementResult = {
  analysisId: string
  dealId: string
  filledDealFields: string[]
  source: 'ai' | 'deterministic'
  humanReviewRequired: true
  autoSubmit: false
}

export type ReviewStatementResult = {
  analysisId: string
  reviewedAt: string
}

function parseCommandInput<T>(schema: { parse: (input: unknown) => T }, rawInput: unknown): T {
  return schema.parse(rawInput)
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

async function requireDeal(
  em: EntityManager,
  dealId: string,
  scope: { tenantId: string; organizationId: string },
): Promise<McaDeal> {
  const deal = await findOneWithDecryption(
    em,
    McaDeal,
    { id: dealId, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null },
    undefined,
    scope,
  )
  if (!deal) throw new CrudHttpError(404, { error: '[internal] MCA deal not found' })
  return deal
}

async function loadAttachmentContent(
  em: EntityManager,
  attachmentId: string | null | undefined,
  scope: { tenantId: string; organizationId: string },
): Promise<string> {
  if (!attachmentId) return ''
  const attachment = await findOneWithDecryption(
    em,
    Attachment,
    { id: attachmentId, tenantId: scope.tenantId, organizationId: scope.organizationId },
    undefined,
    scope,
  )
  return typeof attachment?.content === 'string' ? attachment.content : ''
}

async function findExistingAnalysis(
  em: EntityManager,
  input: { dealId: string; attachmentId?: string | null },
  scope: { tenantId: string; organizationId: string },
): Promise<McaStatementAnalysis | null> {
  const where: Record<string, unknown> = {
    dealId: input.dealId,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  }
  if (input.attachmentId) where.attachmentId = input.attachmentId
  const rows = await findWithDecryption(em, McaStatementAnalysis, where, { orderBy: { createdAt: 'DESC' }, limit: 1 }, scope)
  return rows[0] ?? null
}

const analyzeStatementCommand: CommandHandler<StatementAnalyzeInput, AnalyzeStatementResult> = {
  id: 'merchant_advances.statement.analyze',
  async execute(rawInput, ctx) {
    const input = parseCommandInput(statementAnalyzeSchema, rawInput)
    const scope = resolveCommandScope(ctx, input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const deal = await requireDeal(em, input.dealId, scope)

    if (input.documentId) {
      const document = await findOneWithDecryption(
        em,
        McaDocument,
        {
          id: input.documentId,
          dealId: deal.id,
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        undefined,
        scope,
      )
      if (!document) throw new CrudHttpError(404, { error: '[internal] MCA statement document not found' })
    }

    const markdown = input.markdown?.trim() || await loadAttachmentContent(em, input.attachmentId, scope)
    const extracted = await extractStatementWithOptionalAi(markdown, ctx.container)
    const existing = await findExistingAnalysis(em, input, scope)
    if (existing?.reviewedAt && !input.force) {
      const box = combineDealAttributes(deal, extracted.metrics)
      await emitMerchantAdvancesEvent('merchant_advances.statement.analyzed', {
        id: existing.id,
        dealId: deal.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        source: extracted.source,
        humanReviewRequired: box.humanReviewRequired,
        autoSubmit: box.autoSubmit,
        reused: true,
      }, { persistent: true, tenantId: scope.tenantId, organizationId: scope.organizationId })
      return {
        analysisId: existing.id,
        dealId: deal.id,
        filledDealFields: [],
        source: extracted.source,
        humanReviewRequired: true,
        autoSubmit: false,
      }
    }

    const fill = resolveDealFieldFill(deal, extracted.metrics)
    const filledDealFields = Object.keys(fill)
    const analysis = existing ?? em.create(McaStatementAnalysis, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      dealId: deal.id,
    })

    await withAtomicFlush(em, [
      () => {
        analysis.attachmentId = input.attachmentId ?? analysis.attachmentId ?? null
        analysis.avgMonthlyRevenue = formatMetricMoney(extracted.metrics.avgMonthlyRevenue)
        analysis.avgDailyBalance = formatMetricMoney(extracted.metrics.avgDailyBalance)
        analysis.depositCount = formatMetricCount(extracted.metrics.depositCount)
        analysis.nsfCount = formatMetricCount(extracted.metrics.nsfCount)
        analysis.negativeDays = formatMetricCount(extracted.metrics.negativeDays)
        analysis.existingPositions = formatMetricCount(extracted.metrics.existingPositions)
        analysis.model = extracted.model
        analysis.confidence = extracted.confidence === null ? null : extracted.confidence.toFixed(2)
        analysis.notes = extracted.notes
        if (input.force) {
          analysis.reviewedAt = null
          analysis.reviewedByUserId = null
        }
        if (!existing) em.persist(analysis)

        if (fill.avgMonthlyRevenue) deal.avgMonthlyRevenue = fill.avgMonthlyRevenue
        if (fill.position) deal.position = fill.position
        if (deal.pipelineStatus === 'new_app' && canTransition('new_app', 'statements_in')) {
          deal.pipelineStatus = 'statements_in'
        }
      },
    ], { transaction: true, label: 'merchant_advances.statement.analyze' })

    const box = combineDealAttributes(deal, extracted.metrics)
    await emitMerchantAdvancesEvent('merchant_advances.statement.analyzed', {
      id: analysis.id,
      dealId: deal.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      source: extracted.source,
      filledDealFields,
      humanReviewRequired: box.humanReviewRequired,
      autoSubmit: box.autoSubmit,
    }, { persistent: true, tenantId: scope.tenantId, organizationId: scope.organizationId })

    if (filledDealFields.length) {
      await emitMerchantAdvancesEvent('merchant_advances.deal.updated', {
        id: deal.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        filledFromStatement: filledDealFields,
      }, { persistent: true, tenantId: scope.tenantId, organizationId: scope.organizationId })
    }

    logger.info('statement analysis written', {
      analysisId: analysis.id,
      dealId: deal.id,
      source: extracted.source,
      filledDealFields,
    })

    return {
      analysisId: analysis.id,
      dealId: deal.id,
      filledDealFields,
      source: extracted.source,
      humanReviewRequired: true,
      autoSubmit: false,
    }
  },
  buildLog: async ({ result }) => ({
    actionLabel: 'merchant_advances.audit.statement.analyze',
    resourceKind: MCA_ANALYSIS_RESOURCE_KIND,
    resourceId: result.analysisId,
    parentResourceKind: 'merchant_advances.deal',
    parentResourceId: result.dealId,
  }),
}

const reviewStatementCommand: CommandHandler<StatementReviewInput, ReviewStatementResult> = {
  id: 'merchant_advances.statement.review',
  async execute(rawInput, ctx) {
    const input = parseCommandInput(statementReviewSchema, rawInput)
    const scope = resolveCommandScope(ctx, input)
    const actorUserId = ctx.auth?.sub ?? null
    if (!actorUserId) {
      throw new CrudHttpError(401, { error: '[internal] statement review requires an authenticated underwriter' })
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const analysis = await findOneWithDecryption(
      em,
      McaStatementAnalysis,
      { id: input.id, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null },
      undefined,
      scope,
    )
    if (!analysis) throw new CrudHttpError(404, { error: '[internal] statement analysis not found' })
    if (input.updatedAt) {
      const expected = toIso(analysis.updatedAt)
      if (expected && expected !== input.updatedAt) {
        throw new CrudHttpError(409, { error: '[internal] statement analysis was updated by someone else' })
      }
    }

    const reviewedAt = new Date()
    await withAtomicFlush(em, [
      () => {
        analysis.reviewedAt = reviewedAt
        analysis.reviewedByUserId = actorUserId
      },
    ], { transaction: true, label: 'merchant_advances.statement.review' })

    await emitMerchantAdvancesEvent('merchant_advances.statement.analyzed', {
      id: analysis.id,
      dealId: analysis.dealId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      reviewed: true,
      reviewedByUserId: actorUserId,
      humanReviewRequired: false,
      autoSubmit: false,
    }, { persistent: true, tenantId: scope.tenantId, organizationId: scope.organizationId })

    return { analysisId: analysis.id, reviewedAt: reviewedAt.toISOString() }
  },
  buildLog: async ({ result, ctx }) => ({
    actionLabel: 'merchant_advances.audit.statement.review',
    resourceKind: MCA_ANALYSIS_RESOURCE_KIND,
    resourceId: result.analysisId,
    actorUserId: ctx.auth?.sub ?? null,
  }),
}

registerCommand(analyzeStatementCommand)
registerCommand(reviewStatementCommand)

export function createSystemCommandContext(
  container: CommandRuntimeContext['container'],
  scope: { tenantId: string; organizationId: string },
): CommandRuntimeContext {
  return {
    container,
    auth: null,
    organizationScope: null,
    selectedOrganizationId: scope.organizationId,
    organizationIds: [scope.organizationId],
    systemActor: true,
  }
}
