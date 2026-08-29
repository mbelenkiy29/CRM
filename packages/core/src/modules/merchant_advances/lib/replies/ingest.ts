import { randomUUID } from 'crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { McaDeal, McaFunder, McaFunderReply, McaOffer, McaSubmission } from '../../data/entities'
import type { McaPipelineStatus, McaSubmissionStatus } from '../../data/constants'
import { emitMerchantAdvancesEvent } from '../../events'
import { applyLegalPath, shortestLegalPath } from '../pipeline'
import {
  classifiedFromStructured,
  classifyReply,
  hasOfferTerms,
  type ClassifiedReply,
} from './classifyReply'
import { matchInboundReply, type ReplyMatchCandidate } from './matchDeal'

export type InboundReplyInput = {
  organizationId: string
  tenantId: string
  subject?: string | null
  body?: string | null
  from?: string | null
  to?: string | null
  attachments?: Array<{ filename?: string; contentType?: string }>
  dealId?: string | null
  funderId?: string | null
  funderReference?: string | null
  source?: 'email' | 'api' | 'manual'
  status?: string | null
  amount?: string | number | null
  factor?: string | number | null
  termMonths?: number | null
  paymentAmount?: string | number | null
  paymentFrequency?: 'daily' | 'weekly' | 'monthly' | null
  feesAmount?: string | number | null
  commissionPoints?: string | number | null
  stips?: string[] | null
  declineReason?: string | null
}

export type IngestReplyResult = {
  replyId: string
  dealId: string
  submissionId: string | null
  classification: string
  offerId: string | null
  unmatched: false
} | {
  replyId: null
  dealId: null
  submissionId: null
  classification: string
  offerId: null
  unmatched: true
}

function parseInbound(input: InboundReplyInput): ClassifiedReply {
  if (input.status || input.amount != null) {
    return classifiedFromStructured(input)
  }
  return classifyReply([input.subject, input.body].filter(Boolean).join('\n'))
}

function submissionStatusFor(parsed: ClassifiedReply): McaSubmissionStatus | null {
  if (parsed.classification === 'offer') return 'offered'
  if (parsed.classification === 'decline') return 'declined'
  if (parsed.classification === 'stip_request') return 'stips'
  return null
}

export async function ingestInboundReply(
  em: EntityManager,
  input: InboundReplyInput,
): Promise<IngestReplyResult> {
  const parsed = parseInbound(input)
  const submissions = await em.find(McaSubmission, {
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    deletedAt: null,
    ...(input.dealId ? { dealId: input.dealId } : {}),
    ...(input.funderId ? { funderId: input.funderId } : {}),
  })
  const dealIds = [...new Set(submissions.map((row) => row.dealId))]
  const funderIds = [...new Set(submissions.map((row) => row.funderId))]
  const deals = dealIds.length
    ? await em.find(McaDeal, {
      id: { $in: dealIds },
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      deletedAt: null,
    })
    : []
  const funders = funderIds.length
    ? await em.find(McaFunder, {
      id: { $in: funderIds },
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      deletedAt: null,
    })
    : []
  const candidates: ReplyMatchCandidate[] = submissions.map((submission) => {
    const deal = deals.find((row) => row.id === submission.dealId)
    const funder = funders.find((row) => row.id === submission.funderId)
    return {
      dealId: submission.dealId,
      submissionId: submission.id,
      funderId: submission.funderId,
      businessName: deal?.businessName ?? '',
      funderName: funder?.name ?? '',
      funderCode: funder?.code ?? null,
      submitEmail: funder?.submitEmail ?? null,
      funderReference: submission.funderReference ?? input.funderReference ?? null,
      updatedAt: submission.updatedAt,
    }
  })
  const match = matchInboundReply({
    dealId: input.dealId,
    funderId: input.funderId,
    funderReference: input.funderReference,
    from: input.from,
    to: input.to,
    subject: input.subject,
    body: input.body,
  }, candidates)

  if (!match) {
    return {
      replyId: null,
      dealId: null,
      submissionId: null,
      classification: parsed.classification,
      offerId: null,
      unmatched: true,
    }
  }

  const deal = deals.find((row) => row.id === match.dealId)
  const submission = submissions.find((row) => row.id === match.submissionId)
  if (!deal || !submission) {
    return {
      replyId: null,
      dealId: null,
      submissionId: null,
      classification: parsed.classification,
      offerId: null,
      unmatched: true,
    }
  }

  const reply = em.create(McaFunderReply, {
    id: randomUUID(),
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    dealId: deal.id,
    submissionId: submission.id,
    rawSource: input.source === 'api' || input.status ? 'api' : 'email',
    classification: parsed.classification,
    rawBody: [input.subject, input.body].filter(Boolean).join('\n\n') || null,
    parsedPayload: {
      amount: parsed.amount,
      factor: parsed.factor,
      termMonths: parsed.termMonths,
      paymentAmount: parsed.paymentAmount,
      paymentFrequency: parsed.paymentFrequency,
      feesAmount: parsed.feesAmount,
      commissionPoints: parsed.commissionPoints,
      stips: parsed.stips,
      declineReason: parsed.declineReason,
      from: input.from ?? null,
      to: input.to ?? null,
      attachments: input.attachments ?? [],
    },
    confidence: parsed.classification === 'other' ? '40.00' : '85.00',
  })
  em.persist(reply)

  const nextSubmissionStatus = submissionStatusFor(parsed)
  if (nextSubmissionStatus) submission.status = nextSubmissionStatus
  if (parsed.classification === 'decline') {
    submission.declineReason = parsed.declineReason
  }

  let offerId: string | null = null
  if (hasOfferTerms(parsed)) {
    const offer = em.create(McaOffer, {
      id: randomUUID(),
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      dealId: deal.id,
      submissionId: submission.id,
      funderId: match.funderId,
      amount: parsed.amount,
      factor: parsed.factor,
      termMonths: parsed.termMonths,
      paymentAmount: parsed.paymentAmount,
      paymentFrequency: parsed.paymentFrequency,
      feesAmount: parsed.feesAmount,
      commissionPoints: parsed.commissionPoints,
      stips: parsed.stips.length ? parsed.stips : null,
      status: 'open',
    })
    em.persist(offer)
    offerId = offer.id
    const from = deal.pipelineStatus as McaPipelineStatus
    if (['new_app', 'statements_in', 'underwriting', 'matched', 'submitted'].includes(from)) {
      const path = shortestLegalPath(from, 'offered')
      if (path?.length) deal.pipelineStatus = applyLegalPath(from, path)
    }
  } else if (parsed.classification === 'decline') {
    const live = submissions.filter((row) => (
      row.dealId === deal.id
      && row.id !== submission.id
      && !['declined', 'error'].includes(row.status)
    ))
    if (!live.length) {
      const from = deal.pipelineStatus as McaPipelineStatus
      const path = shortestLegalPath(from, 'declined')
      if (path?.length) deal.pipelineStatus = applyLegalPath(from, path)
    }
  }

  await em.flush()

  await emitMerchantAdvancesEvent('merchant_advances.reply.parsed', {
    id: reply.id,
    organizationId: deal.organizationId,
    tenantId: deal.tenantId,
    dealId: deal.id,
    classification: parsed.classification,
  }, { persistent: true })
  if (offerId) {
    await emitMerchantAdvancesEvent('merchant_advances.offer.created', {
      id: offerId,
      organizationId: deal.organizationId,
      tenantId: deal.tenantId,
      dealId: deal.id,
    }, { persistent: true })
  }

  return {
    replyId: reply.id,
    dealId: deal.id,
    submissionId: submission.id,
    classification: parsed.classification,
    offerId,
    unmatched: false,
  }
}
