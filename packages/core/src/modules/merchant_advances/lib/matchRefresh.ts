import type { EntityManager } from '@mikro-orm/postgresql'
import { McaDeal, McaFunder, McaFunderMatch, McaStatementAnalysis } from '../data/entities'
import type { McaPipelineStatus } from '../data/constants'
import { emitMerchantAdvancesEvent } from '../events'
import {
  parseFunderCriteria,
  scoreFunder,
  type ScoreableDeal,
} from './funderScore'
import { applyLegalPath, shortestLegalPath } from './pipeline'

const AUTO_MATCH_FROM = new Set<McaPipelineStatus>([
  'new_app',
  'statements_in',
  'underwriting',
])

export type MatchRefreshResult = {
  dealId: string
  matchCount: number
  topScore: string | null
}

function mergeScoreableDeal(deal: McaDeal, analysis: McaStatementAnalysis | null): ScoreableDeal {
  return {
    industry: deal.industry,
    state: deal.state,
    avgMonthlyRevenue: analysis?.avgMonthlyRevenue ?? deal.avgMonthlyRevenue,
    timeInBusinessMonths: deal.timeInBusinessMonths,
    position: deal.position ?? analysis?.existingPositions ?? null,
    requestedAmount: deal.requestedAmount,
    nsfCount: analysis?.nsfCount ?? null,
    negativeDays: analysis?.negativeDays ?? null,
    existingPositions: analysis?.existingPositions ?? deal.position ?? null,
    depositCount: analysis?.depositCount ?? null,
    avgDailyBalance: analysis?.avgDailyBalance ?? null,
  }
}

export async function refreshFunderMatches(
  em: EntityManager,
  input: { dealId: string; organizationId: string; tenantId: string },
): Promise<MatchRefreshResult> {
  const deal = await em.findOne(McaDeal, {
    id: input.dealId,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    deletedAt: null,
  })
  if (!deal) {
    throw new Error('[internal] MCA deal not found for matching')
  }

  const analysis = await em.findOne(
    McaStatementAnalysis,
    {
      dealId: deal.id,
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      deletedAt: null,
    },
    { orderBy: { createdAt: 'DESC' } },
  )

  const funders = await em.find(McaFunder, {
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    isActive: true,
    deletedAt: null,
  })

  const existing = await em.find(McaFunderMatch, {
    dealId: deal.id,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    deletedAt: null,
  })
  const now = new Date()
  for (const match of existing) match.deletedAt = now

  const scoreable = mergeScoreableDeal(deal, analysis)
  const ranked = funders
    .map((funder) => {
      const scored = scoreFunder(scoreable, parseFunderCriteria(funder.criteria))
      return { funder, scored }
    })
    .sort((left, right) => right.scored.score - left.scored.score)

  ranked.forEach((row, index) => {
    em.persist(em.create(McaFunderMatch, {
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      dealId: deal.id,
      funderId: row.funder.id,
      score: row.scored.score.toFixed(2),
      reasons: row.scored.reasons,
      rank: index + 1,
    }))
  })

  const from = deal.pipelineStatus as McaPipelineStatus
  if (AUTO_MATCH_FROM.has(from) && ranked.length) {
    const path = shortestLegalPath(from, 'matched')
    if (path?.length) {
      deal.pipelineStatus = applyLegalPath(from, path)
    }
  }

  await em.flush()

  await emitMerchantAdvancesEvent(
    'merchant_advances.funder.matched',
    {
      id: deal.id,
      organizationId: deal.organizationId,
      tenantId: deal.tenantId,
      matchCount: ranked.length,
      topFunderId: ranked[0]?.funder.id ?? null,
    },
    { persistent: true },
  )

  return {
    dealId: deal.id,
    matchCount: ranked.length,
    topScore: ranked[0] ? ranked[0].scored.score.toFixed(2) : null,
  }
}
