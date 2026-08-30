import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { renewalListQuerySchema } from '../../../data/validators'
import { loadRenewalQueue } from '../../../lib/renewalList'
import { createPagedListResponseSchema } from '../../openapi'
import { resolveMerchantAdvancesRouteContext } from '../../routeContext'

const logger = createLogger('merchant_advances')

const renewalItemSchema = z.object({
  id: z.string(),
  dealId: z.string().uuid(),
  fundingId: z.string().uuid(),
  merchantCompanyId: z.string().uuid().nullable(),
  merchantName: z.string().nullable(),
  paidInPct: z.string().nullable(),
  remainingDays: z.number().nullable(),
  status: z.string(),
  fundedAt: z.string().nullable(),
  termMonths: z.number().nullable(),
  paymentFrequency: z.string().nullable(),
  surfacedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

const pastApprovalItemSchema = z.object({
  dealId: z.string().uuid(),
  fundingId: z.string().uuid().nullable(),
  merchantCompanyId: z.string().uuid().nullable(),
  merchantName: z.string().nullable(),
  paidInPct: z.string().nullable(),
  fundedAt: z.string().nullable(),
  pipelineStatus: z.string(),
  updatedAt: z.string().nullable(),
})

const responseSchema = createPagedListResponseSchema(renewalItemSchema).extend({
  pastApproval: z.array(pastApprovalItemSchema),
  pastApprovalTotal: z.number().int().nonnegative(),
  threshold: z.number().int(),
})

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.renewal.view'] },
}

export async function GET(req: Request) {
  try {
    const context = await resolveMerchantAdvancesRouteContext(req)
    const query = renewalListQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams))
    const result = await loadRenewalQueue(context.em, {
      tenantId: context.tenantId,
      organizationId: context.organizationId,
    }, query)
    return NextResponse.json(result)
  } catch (error) {
    if (isCrudHttpError(error)) {
      return NextResponse.json(error.body, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'merchant_advances.errors.invalidInput' }, { status: 400 })
    }
    const { translate } = await resolveTranslations()
    logger.error('merchant_advances.renewals.queue failed', { err: error })
    return NextResponse.json({ error: translate('merchant_advances.errors.loadFailed', 'Failed to load renewals') }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'MCA renewals queue',
  methods: {
    GET: {
      summary: 'List approaching renewals and past-approval follow-ups',
      description: 'Returns tenant- and organization-scoped merchants approaching renewal (paid-in threshold or term remaining) plus funded merchants without an open deal. Requires merchant_advances.renewal.view.',
      query: renewalListQuerySchema,
      responses: [
        {
          status: 200,
          description: 'Renewal queue',
          schema: responseSchema,
        },
      ],
    },
  },
}
