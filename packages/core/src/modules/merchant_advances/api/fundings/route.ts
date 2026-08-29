import type { EntityManager } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { McaCommission, McaCommissionSplit, McaFunding } from '../../data/entities'
import { fundingCreateSchema } from '../../data/validators'
import {
  createMerchantAdvancesCrudOpenApi,
  createPagedListResponseSchema,
} from '../openapi'
import {
  rawBodySchema,
  readString,
  scopeFromContext,
  toIso,
  toRecord,
} from '../../lib/crudScope'

const uuid = z.string().uuid()
const listSchema = z.object({
  id: uuid.optional(),
  dealId: uuid.optional(),
  offerId: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortField: z.enum(['updatedAt', 'createdAt', 'fundedAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

type ListQuery = z.infer<typeof listSchema>
type RawInput = z.infer<typeof rawBodySchema>

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.deal.view'] },
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.deal.manage', 'merchant_advances.offer.manage'] },
}

export const metadata = routeMetadata

function transformFunding(item: unknown): Record<string, unknown> {
  const record = toRecord(item)
  if (!Object.keys(record).length) return record
  return {
    id: readString(record, 'id', 'id'),
    dealId: readString(record, 'deal_id', 'dealId'),
    offerId: readString(record, 'offer_id', 'offerId'),
    fundedAmount: readString(record, 'funded_amount', 'fundedAmount'),
    fundedAt: toIso(record.funded_at ?? record.fundedAt),
    termMonths: record.term_months ?? record.termMonths ?? null,
    paymentFrequency: readString(record, 'payment_frequency', 'paymentFrequency'),
    paymentAmount: readString(record, 'payment_amount', 'paymentAmount'),
    paybackAmount: readString(record, 'payback_amount', 'paybackAmount'),
    paidInPct: readString(record, 'paid_in_pct', 'paidInPct'),
    createdAt: toIso(record.created_at ?? record.createdAt),
    updatedAt: toIso(record.updated_at ?? record.updatedAt),
    commission: null,
  }
}

const crud = makeCrudRoute<RawInput, RawInput, ListQuery>({
  metadata: routeMetadata,
  orm: {
    entity: McaFunding,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'merchant_advances:mca_funding' },
  events: {
    module: 'merchant_advances',
    entity: 'funding',
    persistent: true,
  },
  list: {
    schema: listSchema,
    entityId: 'merchant_advances:mca_funding',
    fields: [
      'id', 'deal_id', 'offer_id', 'funded_amount', 'funded_at', 'term_months',
      'payment_frequency', 'payment_amount', 'payback_amount', 'paid_in_pct',
      'created_at', 'updated_at',
    ],
    sortFieldMap: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      fundedAt: 'funded_at',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.dealId) filters.deal_id = { $eq: query.dealId }
      if (query.offerId) filters.offer_id = { $eq: query.offerId }
      return filters
    },
    transformItem: transformFunding,
  },
  hooks: {
    afterList: async (payload, ctx) => {
      const items = Array.isArray(payload.items) ? payload.items as Array<Record<string, unknown>> : []
      const fundingIds = items
        .map((item) => (typeof item.id === 'string' ? item.id : null))
        .filter((id): id is string => Boolean(id))
      if (!fundingIds.length) return
      const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
      const tenantId = ctx.auth?.tenantId ?? null
      if (!organizationId || !tenantId) return
      const em = ctx.container.resolve('em') as EntityManager
      const commissions = await em.find(McaCommission, {
        fundingId: { $in: fundingIds },
        organizationId,
        tenantId,
        deletedAt: null,
      })
      const commissionIds = commissions.map((commission) => commission.id)
      const splits = commissionIds.length
        ? await em.find(McaCommissionSplit, {
          commissionId: { $in: commissionIds },
          organizationId,
          tenantId,
          deletedAt: null,
        })
        : []
      const splitsByCommission = new Map<string, Array<Record<string, unknown>>>()
      for (const split of splits) {
        const rows = splitsByCommission.get(split.commissionId) ?? []
        rows.push({
          id: split.id,
          userId: split.userId ?? null,
          role: split.role ?? null,
          points: split.points ?? null,
          amount: split.amount ?? null,
        })
        splitsByCommission.set(split.commissionId, rows)
      }
      const commissionByFunding = new Map(commissions.map((commission) => [commission.fundingId, commission]))
      for (const item of items) {
        const fundingId = typeof item.id === 'string' ? item.id : null
        if (!fundingId) continue
        const commission = commissionByFunding.get(fundingId)
        item.commission = commission
          ? {
              id: commission.id,
              points: commission.points ?? null,
              amount: commission.amount ?? null,
              currency: commission.currency ?? null,
              splits: splitsByCommission.get(commission.id) ?? [],
            }
          : null
      }
    },
  },
  actions: {
    create: {
      commandId: 'merchant_advances.fundings.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate, {
          messages: {
            tenantRequired: { key: 'merchant_advances.errors.scopeMissing', fallback: 'Tenant context is required.' },
            organizationRequired: { key: 'merchant_advances.errors.scopeMissing', fallback: 'Organization context is required.' },
          },
        })
        return fundingCreateSchema.parse({ ...scoped, ...scopeFromContext(ctx) })
      },
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST

const fundingItemSchema = z.object({
  id: z.string().uuid().nullable(),
  dealId: z.string().uuid().nullable(),
  fundedAmount: z.string().nullable(),
  paybackAmount: z.string().nullable(),
  paymentAmount: z.string().nullable(),
  updatedAt: z.string().nullable(),
  commission: z.object({
    id: z.string().uuid(),
    points: z.string().nullable(),
    amount: z.string().nullable(),
    currency: z.string().nullable(),
    splits: z.array(z.object({
      id: z.string().uuid(),
      userId: z.string().uuid().nullable(),
      role: z.string().nullable(),
      points: z.string().nullable(),
      amount: z.string().nullable(),
    })),
  }).nullable().optional(),
}).passthrough()

export const openApi = createMerchantAdvancesCrudOpenApi({
  resourceName: 'McaFunding',
  pluralName: 'McaFundings',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(fundingItemSchema),
  create: {
    schema: fundingCreateSchema,
    responseSchema: z.object({
      id: z.string().uuid(),
      fundingId: z.string().uuid(),
      commissionId: z.string().uuid(),
      fundedAmount: z.string(),
      paybackAmount: z.string(),
      paymentAmount: z.string(),
      commissionAmount: z.string(),
    }).passthrough(),
    description: 'Accepts an offer and writes funding, commission, and default or custom splits.',
  },
})
