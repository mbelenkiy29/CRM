import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { McaDeal, McaDocument } from '../../data/entities'
import { enqueueStatementAnalysis, type AnalyzeStatementJobPayload } from './queue'

const logger = createLogger('merchant_advances').child({ component: 'statement-enqueue' })

const DEAL_ENTITY_ID = 'merchant_advances:mca_deal'
const DOCUMENT_ENTITY_ID = 'merchant_advances:mca_document'
const STATEMENT_NAME_RE = /statement|bank|checking|deposit/i

export type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function looksLikeStatement(fileName: string | null, mimeType: string | null): boolean {
  if (fileName && STATEMENT_NAME_RE.test(fileName)) return true
  if (mimeType && (mimeType.includes('pdf') || mimeType.startsWith('image/'))) return true
  return false
}

export async function enqueueAnalysesForDeal(
  payload: { dealId: string; tenantId: string; organizationId: string },
  ctx: ResolverContext,
): Promise<void> {
  const em = ctx.resolve<EntityManager>('em').fork()
  const scope = { tenantId: payload.tenantId, organizationId: payload.organizationId }
  const deal = await findOneWithDecryption(
    em,
    McaDeal,
    { id: payload.dealId, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null },
    undefined,
    scope,
  )
  if (!deal) return

  const documents = await findWithDecryption(
    em,
    McaDocument,
    { dealId: deal.id, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null, classification: 'statement' },
    undefined,
    scope,
  )
  for (const document of documents) {
    await enqueueStatementAnalysis({
      dealId: deal.id,
      attachmentId: document.attachmentId,
      documentId: document.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })
  }
}

export async function enqueueAnalysisFromAttachment(
  payload: Record<string, unknown>,
  ctx: ResolverContext,
): Promise<void> {
  const attachmentId = asString(payload.id)
  const tenantId = asString(payload.tenantId)
  const organizationId = asString(payload.organizationId)
  const entityId = asString(payload.entityId)
  const recordId = asString(payload.recordId)
  if (!attachmentId || !tenantId || !organizationId) return

  const em = ctx.resolve<EntityManager>('em').fork()
  const scope = { tenantId, organizationId }
  const document = await findOneWithDecryption(
    em,
    McaDocument,
    { attachmentId, tenantId, organizationId, deletedAt: null },
    undefined,
    scope,
  )

  let dealId: string | null = document?.dealId ?? null
  if (!dealId && entityId === DEAL_ENTITY_ID) dealId = recordId
  if (!dealId && entityId === DOCUMENT_ENTITY_ID && recordId) {
    const byId = await findOneWithDecryption(
      em,
      McaDocument,
      { id: recordId, tenantId, organizationId, deletedAt: null },
      undefined,
      scope,
    )
    if (byId?.classification === 'statement') {
      dealId = byId.dealId
    }
  }

  if (!dealId) return
  if (document && document.classification !== 'statement') return

  if (!document) {
    const attachment = await findOneWithDecryption(
      em,
      Attachment,
      { id: attachmentId, tenantId, organizationId },
      undefined,
      scope,
    )
    if (!looksLikeStatement(attachment?.fileName ?? null, attachment?.mimeType ?? null)) {
      logger.debug('skipping attachment that is not a statement', { attachmentId, dealId })
      return
    }
  }

  const job: AnalyzeStatementJobPayload = {
    dealId,
    attachmentId,
    documentId: document?.id ?? null,
    tenantId,
    organizationId,
  }
  await enqueueStatementAnalysis(job)
}
