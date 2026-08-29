import type { McaDeal, McaStatementAnalysis } from '../../data/entities'
import { combineDealAttributes } from './applyDealFill'
import { extractStatementMetrics } from './extractStatement'

export function serializeAnalysis(analysis: McaStatementAnalysis, deal?: McaDeal | null) {
  const extracted = {
    avgMonthlyRevenue: analysis.avgMonthlyRevenue ? Number(analysis.avgMonthlyRevenue) : null,
    avgDailyBalance: analysis.avgDailyBalance ? Number(analysis.avgDailyBalance) : null,
    depositCount: analysis.depositCount ?? null,
    nsfCount: analysis.nsfCount ?? null,
    negativeDays: analysis.negativeDays ?? null,
    existingPositions: analysis.existingPositions ?? null,
  }
  const metrics = {
    avgMonthlyRevenue: Number.isFinite(extracted.avgMonthlyRevenue) ? extracted.avgMonthlyRevenue : null,
    avgDailyBalance: Number.isFinite(extracted.avgDailyBalance) ? extracted.avgDailyBalance : null,
    depositCount: extracted.depositCount,
    nsfCount: extracted.nsfCount,
    negativeDays: extracted.negativeDays,
    existingPositions: extracted.existingPositions,
  }
  return {
    id: analysis.id,
    dealId: analysis.dealId,
    attachmentId: analysis.attachmentId ?? null,
    avgMonthlyRevenue: analysis.avgMonthlyRevenue ?? null,
    avgDailyBalance: analysis.avgDailyBalance ?? null,
    depositCount: analysis.depositCount ?? null,
    nsfCount: analysis.nsfCount ?? null,
    negativeDays: analysis.negativeDays ?? null,
    existingPositions: analysis.existingPositions ?? null,
    model: analysis.model ?? null,
    confidence: analysis.confidence ?? null,
    notes: analysis.notes ?? null,
    reviewedByUserId: analysis.reviewedByUserId ?? null,
    reviewedAt: analysis.reviewedAt ? analysis.reviewedAt.toISOString() : null,
    createdAt: analysis.createdAt.toISOString(),
    updatedAt: analysis.updatedAt.toISOString(),
    firstPass: deal
      ? combineDealAttributes(deal, {
        avgMonthlyRevenue: metrics.avgMonthlyRevenue,
        avgDailyBalance: metrics.avgDailyBalance,
        depositCount: metrics.depositCount,
        nsfCount: metrics.nsfCount,
        negativeDays: metrics.negativeDays,
        existingPositions: metrics.existingPositions,
      })
      : combineDealAttributes({}, extractStatementMetrics('')),
  }
}
