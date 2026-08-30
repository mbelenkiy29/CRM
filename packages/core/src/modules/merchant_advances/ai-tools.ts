import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { AwilixContainer } from 'awilix'
import { defineAiTool } from '@open-mercato/ai-assistant/modules/ai_assistant/lib/ai-tool-definition'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { McaDeal, McaStatementAnalysis } from './data/entities'
import { serializeAnalysis } from './lib/underwriting/serializeAnalysis'
import { enqueueStatementAnalysis } from './lib/underwriting/queue'
import { statementAnalyzeSchema } from './data/validators'

type ToolContext = {
  tenantId: string | null
  organizationId: string | null
  userId: string | null
  container: AwilixContainer
  userFeatures: string[]
  isSuperAdmin: boolean
}

function requireScope(ctx: ToolContext): { tenantId: string; organizationId: string } {
  if (!ctx.tenantId || !ctx.organizationId) {
    throw new Error('[internal] merchant_advances AI tools require tenant and organization scope')
  }
  return { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
}

const getAnalysisTool = defineAiTool({
  name: 'merchant_advances.get_statement_analysis',
  description: 'Read first-pass bank-statement underwriting metrics for an MCA deal. Does not replace a human underwriter and never submits funders.',
  inputSchema: z.object({
    dealId: z.string().uuid().describe('MCA deal id'),
  }),
  requiredFeatures: ['merchant_advances.deal.view'],
  handler: async (input, ctx: ToolContext) => {
    const scope = requireScope(ctx)
    const em = ctx.container.resolve<EntityManager>('em').fork()
    const deal = await findOneWithDecryption(
      em,
      McaDeal,
      { id: input.dealId, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null },
      undefined,
      scope,
    )
    if (!deal) throw new Error('[internal] MCA deal not found')
    const analyses = await findWithDecryption(
      em,
      McaStatementAnalysis,
      { dealId: deal.id, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null },
      { orderBy: { createdAt: 'DESC' }, limit: 5 },
      scope,
    )
    return {
      dealId: deal.id,
      humanReviewRequired: true,
      autoSubmit: false,
      items: analyses.map((analysis) => serializeAnalysis(analysis, deal)),
    }
  },
})

const rerunAnalysisTool = defineAiTool({
  name: 'merchant_advances.rerun_statement_analysis',
  description: 'Queue a first-pass re-analysis of bank statements on an MCA deal. A human must still review the box check. Never auto-submits funders.',
  inputSchema: statementAnalyzeSchema.pick({ dealId: true, attachmentId: true, documentId: true }),
  requiredFeatures: ['merchant_advances.deal.manage'],
  isMutation: true,
  handler: async (input, ctx: ToolContext) => {
    const scope = requireScope(ctx)
    const em = ctx.container.resolve<EntityManager>('em').fork()
    const deal = await findOneWithDecryption(
      em,
      McaDeal,
      { id: input.dealId, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null },
      undefined,
      scope,
    )
    if (!deal) throw new Error('[internal] MCA deal not found')
    await enqueueStatementAnalysis({
      dealId: deal.id,
      attachmentId: input.attachmentId ?? null,
      documentId: input.documentId ?? null,
      force: true,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })
    return {
      ok: true,
      queued: true,
      dealId: deal.id,
      humanReviewRequired: true,
      autoSubmit: false,
    }
  },
  loadBeforeRecord: async (input, ctx: ToolContext) => {
    const scope = requireScope(ctx)
    const em = ctx.container.resolve<EntityManager>('em').fork()
    const deal = await findOneWithDecryption(
      em,
      McaDeal,
      { id: input.dealId, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null },
      undefined,
      scope,
    )
    if (!deal) return null
    return {
      recordId: deal.id,
      entityType: 'merchant_advances:mca_deal',
      recordVersion: deal.updatedAt.toISOString(),
      before: {
        avgMonthlyRevenue: deal.avgMonthlyRevenue ?? null,
        position: deal.position ?? null,
        pipelineStatus: deal.pipelineStatus,
      },
    }
  },
})

export const aiTools = [getAnalysisTool, rerunAnalysisTool]
export default aiTools
