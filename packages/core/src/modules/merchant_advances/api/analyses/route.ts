import { NextResponse } from 'next/server'
import { z } from 'zod'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { McaDeal, McaStatementAnalysis } from '../../data/entities'
import { serializeAnalysis } from '../../lib/underwriting/serializeAnalysis'
import { resolveMerchantAdvancesRouteContext } from '../routeContext'

const logger = createLogger('merchant_advances')
const uuid = z.string().uuid()
const querySchema = z.object({
  dealId: uuid,
})

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.deal.view'] },
}

export async function GET(req: Request) {
  try {
    const context = await resolveMerchantAdvancesRouteContext(req)
    const url = new URL(req.url)
    const parsed = querySchema.safeParse({ dealId: url.searchParams.get('dealId') })
    if (!parsed.success) {
      return NextResponse.json({ error: context.translate('merchant_advances.errors.invalidInput', 'Invalid input') }, { status: 400 })
    }
    const scope = { tenantId: context.tenantId, organizationId: context.organizationId }
    const deal = await findOneWithDecryption(
      context.em,
      McaDeal,
      { id: parsed.data.dealId, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null },
      undefined,
      scope,
    )
    if (!deal) throw new CrudHttpError(404, { error: context.translate('merchant_advances.errors.dealNotFound', 'Deal not found') })

    const analyses = await findWithDecryption(
      context.em,
      McaStatementAnalysis,
      { dealId: deal.id, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null },
      { orderBy: { createdAt: 'DESC' } },
      scope,
    )
    return NextResponse.json({
      items: analyses.map((analysis) => serializeAnalysis(analysis, deal)),
      deal: {
        id: deal.id,
        businessName: deal.businessName,
        pipelineStatus: deal.pipelineStatus,
        requestedAmount: deal.requestedAmount ?? null,
        avgMonthlyRevenue: deal.avgMonthlyRevenue ?? null,
        timeInBusinessMonths: deal.timeInBusinessMonths ?? null,
        position: deal.position ?? null,
        industry: deal.industry ?? null,
        state: deal.state ?? null,
        updatedAt: deal.updatedAt.toISOString(),
      },
    })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    const { translate } = await resolveTranslations()
    logger.error('merchant_advances.analyses.get failed', { err })
    return NextResponse.json({ error: translate('merchant_advances.errors.loadFailed', 'Failed to load statement analyses') }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'List statement analyses',
  methods: {
    GET: {
      summary: 'Returns first-pass statement analyses for a deal',
      query: querySchema,
      responses: [
        {
          status: 200,
          description: 'Analyses for the deal',
          schema: z.object({ items: z.array(z.object({ id: z.string().uuid() }).passthrough()) }).passthrough(),
        },
      ],
    },
  },
}
