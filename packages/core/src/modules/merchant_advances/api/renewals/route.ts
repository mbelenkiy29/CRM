import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { renewalListQuerySchema } from '../../data/validators'
import { loadRenewalQueue } from '../../lib/renewalList'
import { createPagedListResponseSchema } from '../openapi'

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
    const url = new URL(req.url)
    const query = renewalListQuerySchema.parse(Object.fromEntries(url.searchParams))
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    const { translate } = await resolveTranslations()
    if (!auth?.tenantId) {
      throw new CrudHttpError(401, { error: translate('merchant_advances.errors.unauthorized', 'Unauthorized') })
    }
    const orgScope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = orgScope.selectedId ?? auth.orgId ?? null
    if (!organizationId) {
      throw new CrudHttpError(400, { error: translate('merchant_advances.errors.organizationRequired', 'Organization context is required') })
    }
    const em = (container.resolve('em') as EntityManager).fork()
    const result = await loadRenewalQueue(em, {
      tenantId: auth.tenantId,
      organizationId,
    }, query)
    return NextResponse.json(result)
  } catch (error) {
    if (isCrudHttpError(error)) {
      return NextResponse.json(error.body, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'merchant_advances.errors.invalidInput' }, { status: 400 })
    }
    logger.error('[merchant_advances] Failed to load renewals', { error })
    return NextResponse.json({ error: 'merchant_advances.errors.loadFailed' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'MCA renewals queue',
  methods: {
    GET: {
      summary: 'List approaching renewals and past-approval follow-ups',
      description: 'Returns tenant- and organization-scoped merchants approaching renewal (paid-in threshold or term remaining) plus funded merchants without an open deal. Requires merchant_advances.renewal.view. Reports stay behind merchant_advances.reports.view.',
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
