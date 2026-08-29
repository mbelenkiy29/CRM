import type { EntityManager } from '@mikro-orm/postgresql'
import {
  McaCommission,
  McaCommissionSplit,
  McaDeal,
  McaFunding,
  McaLeadBatch,
  McaLeadSource,
  McaOffer,
  McaSubmission,
} from '../../data/entities'
import type { ReportSnapshot } from './aggregates'

export async function loadReportSnapshot(
  em: EntityManager,
  scope: { organizationId: string; tenantId: string },
): Promise<ReportSnapshot> {
  const where = {
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    deletedAt: null,
  }
  const [deals, fundings, commissions, splits, submissions, offers, leadSources, leadBatches] = await Promise.all([
    em.find(McaDeal, where),
    em.find(McaFunding, where),
    em.find(McaCommission, where),
    em.find(McaCommissionSplit, where),
    em.find(McaSubmission, where),
    em.find(McaOffer, where),
    em.find(McaLeadSource, where),
    em.find(McaLeadBatch, where),
  ])
  return {
    deals: deals.map((row) => ({
      id: row.id,
      ownerUserId: row.ownerUserId ?? null,
      pipelineStatus: row.pipelineStatus,
      requestedAmount: row.requestedAmount ?? null,
      leadSourceId: row.leadSourceId ?? null,
      leadBatchId: row.leadBatchId ?? null,
    })),
    fundings: fundings.map((row) => ({
      dealId: row.dealId,
      fundedAmount: row.fundedAmount,
      paymentAmount: row.paymentAmount ?? null,
    })),
    commissions: commissions.map((row) => ({
      dealId: row.dealId,
      amount: row.amount ?? null,
    })),
    splits: splits.map((row) => ({
      userId: row.userId ?? null,
      amount: row.amount ?? null,
    })),
    submissions: submissions.map((row) => ({
      dealId: row.dealId,
      funderId: row.funderId,
      status: row.status,
    })),
    offers: offers.map((row) => ({
      dealId: row.dealId,
      funderId: row.funderId ?? null,
      status: row.status,
    })),
    leadSources: leadSources.map((row) => ({
      id: row.id,
      name: row.name,
      costAmount: row.costAmount ?? null,
    })),
    leadBatches: leadBatches.map((row) => ({
      id: row.id,
      name: row.name,
      leadSourceId: row.leadSourceId ?? null,
      costAmount: row.costAmount ?? null,
      leadCount: row.leadCount ?? null,
    })),
  }
}
