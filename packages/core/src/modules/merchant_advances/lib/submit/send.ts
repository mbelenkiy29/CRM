import { randomUUID } from 'crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { McaDeal, McaDocument, McaFunder, McaSubmission, McaWorkspaceSettings } from '../../data/entities'
import type { McaPipelineStatus, McaSubmitMethod } from '../../data/constants'
import { emitMerchantAdvancesEvent } from '../../events'
import { planProtectedCopies } from '../documents/protectCopy'
import { DUPLICATE_SUBMISSION_CODE, findDuplicateSubmission, merchantIdentityKey } from '../duplicateCheck'
import { applyLegalPath, shortestLegalPath } from '../pipeline'
import { routeSubmission, type SubmitPackage } from './router'

export type SubmitFunderResult = {
  funderId: string
  submissionId: string | null
  status: string | null
  error: string | null
}

export type SubmitDealResult = {
  dealId: string
  results: SubmitFunderResult[]
}

function packageApplication(deal: McaDeal): Record<string, unknown> {
  return {
    businessName: deal.businessName,
    requestedAmount: deal.requestedAmount,
    avgMonthlyRevenue: deal.avgMonthlyRevenue,
    timeInBusinessMonths: deal.timeInBusinessMonths,
    position: deal.position,
    industry: deal.industry,
    state: deal.state,
  }
}

async function postWebhook(url: string, body: string, signature: string): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-signature': signature,
    },
    body,
  })
  if (!response.ok) {
    throw new Error(`[internal] webhook status ${response.status}`)
  }
}

export async function sendDealToFunders(
  em: EntityManager,
  input: { dealId: string; funderIds: string[]; organizationId: string; tenantId: string },
): Promise<SubmitDealResult> {
  const uniqueFunderIds = [...new Set(input.funderIds)]
  const deal = await findOneWithDecryption(
    em,
    McaDeal,
    {
      id: input.dealId,
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      deletedAt: null,
    },
    {},
    { tenantId: input.tenantId, organizationId: input.organizationId },
  )
  if (!deal) throw new Error('[internal] MCA deal not found for submit')

  const settings = await em.findOne(McaWorkspaceSettings, {
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    deletedAt: null,
  })
  const funders = await em.find(McaFunder, {
    id: { $in: uniqueFunderIds },
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    deletedAt: null,
  })
  const originals = await em.find(McaDocument, {
    dealId: deal.id,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    isOriginal: true,
    deletedAt: null,
  })
  const existing = await em.find(McaSubmission, {
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    funderId: { $in: uniqueFunderIds },
    deletedAt: null,
  })
  const relatedDealIds = [...new Set(existing.map((row) => row.dealId))]
  const siblingDeals = relatedDealIds.length
    ? await findWithDecryption(
      em,
      McaDeal,
      {
        id: { $in: relatedDealIds },
        organizationId: input.organizationId,
        tenantId: input.tenantId,
        deletedAt: null,
      },
      {},
      { tenantId: input.tenantId, organizationId: input.organizationId },
    )
    : []
  const merchantKey = merchantIdentityKey({
    ein: deal.ein,
    businessName: deal.businessName,
    state: deal.state,
  })
  const siblingIds = new Set(
    siblingDeals
      .filter((row) => merchantIdentityKey({
        ein: row.ein,
        businessName: row.businessName,
        state: row.state,
      }) === merchantKey)
      .map((row) => row.id),
  )
  const duplicateRows = existing.map((row) => ({
    dealId: row.dealId,
    funderId: row.funderId,
    status: row.status,
    deletedAt: row.deletedAt,
    merchantKey: siblingIds.has(row.dealId) ? merchantKey : null,
  }))

  const results: SubmitFunderResult[] = []
  for (const funderId of uniqueFunderIds) {
    const funder = funders.find((row) => row.id === funderId)
    if (!funder) {
      results.push({ funderId, submissionId: null, status: null, error: 'funder_not_found' })
      continue
    }
    const duplicate = findDuplicateSubmission(duplicateRows, deal.id, funder.id, merchantKey)
    if (duplicate) {
      results.push({
        funderId,
        submissionId: null,
        status: null,
        error: DUPLICATE_SUBMISSION_CODE,
      })
      continue
    }

    const copies = planProtectedCopies({
      originals,
      funderName: funder.name,
      skipProtection: funder.requiresUnstampedStatements,
      watermarkEnabled: settings?.watermarkEnabled !== false,
    })
    for (const copy of copies) {
      const source = originals.find((document) => document.id === copy.sourceDocumentId)
      if (!source) continue
      em.persist(em.create(McaDocument, {
        organizationId: input.organizationId,
        tenantId: input.tenantId,
        dealId: deal.id,
        classification: source.classification,
        attachmentId: source.attachmentId,
        stampedAttachmentId: copy.stamped ? source.attachmentId : null,
        destinationFunderId: funder.id,
        isOriginal: false,
      }))
    }

    const pack: SubmitPackage = {
      dealId: deal.id,
      funderId: funder.id,
      funderName: funder.name,
      method: funder.submitMethod as McaSubmitMethod,
      fromAddress: settings?.defaultFromAddress ?? null,
      submitEmail: funder.submitEmail ?? null,
      portalUrl: funder.portalUrl ?? null,
      webhookUrl: funder.webhookUrl ?? null,
      application: packageApplication(deal),
      documents: copies.map((copy) => ({
        id: copy.sourceDocumentId,
        classification: originals.find((document) => document.id === copy.sourceDocumentId)?.classification ?? 'other_stip',
        attachmentId: copy.sourceAttachmentId,
        stamped: copy.stamped,
      })),
    }
    let routed = routeSubmission(pack, { mailConfigured: Boolean(process.env.RESEND_API_KEY) })
    if (routed.payloadSnapshot.route === 'webhook' && routed.status === 'sent' && typeof routed.payloadSnapshot.body === 'string' && funder.webhookUrl) {
      try {
        await postWebhook(
          funder.webhookUrl,
          routed.payloadSnapshot.body,
          typeof routed.payloadSnapshot.signature === 'string' ? routed.payloadSnapshot.signature : '',
        )
      } catch {
        routed = {
          ...routed,
          status: 'error',
          validationErrors: { code: 'webhook_failed' },
        }
      }
    }

    const current = existing.find((row) => row.dealId === deal.id && row.funderId === funder.id)
    if (current) {
      current.method = funder.submitMethod
      current.status = routed.status
      current.validationErrors = routed.validationErrors
      current.payloadSnapshot = routed.payloadSnapshot
      current.sentFromAddress = settings?.defaultFromAddress ?? null
      current.funderReference = routed.funderReference
      results.push({
        funderId,
        submissionId: current.id,
        status: current.status,
        error: routed.validationErrors ? String(routed.validationErrors.code ?? 'submit_failed') : null,
      })
    } else {
      const created = em.create(McaSubmission, {
        id: randomUUID(),
        organizationId: input.organizationId,
        tenantId: input.tenantId,
        dealId: deal.id,
        funderId: funder.id,
        method: funder.submitMethod,
        status: routed.status,
        validationErrors: routed.validationErrors,
        payloadSnapshot: routed.payloadSnapshot,
        sentFromAddress: settings?.defaultFromAddress ?? null,
        funderReference: routed.funderReference,
      })
      em.persist(created)
      existing.push(created)
      results.push({
        funderId,
        submissionId: created.id,
        status: created.status,
        error: routed.validationErrors ? String(routed.validationErrors.code ?? 'submit_failed') : null,
      })
    }

    await emitMerchantAdvancesEvent(
      routed.status === 'error' ? 'merchant_advances.submission.failed' : 'merchant_advances.submission.created',
      {
        id: deal.id,
        organizationId: deal.organizationId,
        tenantId: deal.tenantId,
        funderId: funder.id,
        status: routed.status,
      },
      { persistent: true },
    )
  }

  const succeeded = results.some((result) => result.status && result.status !== 'error')
  if (succeeded) {
    const from = deal.pipelineStatus as McaPipelineStatus
    if (['new_app', 'statements_in', 'underwriting', 'matched'].includes(from)) {
      const path = shortestLegalPath(from, 'submitted')
      if (path?.length) deal.pipelineStatus = applyLegalPath(from, path)
    }
  }

  await em.flush()
  return { dealId: deal.id, results }
}
