import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { McaRenewal } from '../../data/entities'
import { renewalCreateSchema, renewalUpdateSchema, renewalDeleteSchema } from '../../data/validators'
import {
  createMerchantAdvancesCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'
import {
  hasOwn,
  rawBodySchema,
  readString,
  scopeFromContext,
  toIso,
  toNullableDecimal,
  toRecord,
} from '../../lib/crudScope'

const uuid = z.string().uuid()
const listSchema = z.object({
  id: uuid.optional(),
  dealId: uuid.optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortField: z.enum(['updatedAt', 'createdAt', 'surfacedAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

type ListQuery = z.infer<typeof listSchema>
type RawInput = z.infer<typeof rawBodySchema>

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.renewal.view'] },
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.deal.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['merchant_advances.deal.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['merchant_advances.deal.manage'] },
}

export const metadata = routeMetadata

function transformRenewal(item: unknown): unknown {
  const record = toRecord(item)
  if (!Object.keys(record).length) return item
  return {
    id: readString(record, 'id', 'id'),
    dealId: readString(record, 'deal_id', 'dealId'),
    fundingId: readString(record, 'funding_id', 'fundingId'),
    paidInPct: readString(record, 'paid_in_pct', 'paidInPct'),
    status: readString(record, 'status', 'status'),
    surfacedAt: toIso(record.surfaced_at ?? record.surfacedAt),
    createdAt: toIso(record.created_at ?? record.createdAt),
    updatedAt: toIso(record.updated_at ?? record.updatedAt),
  }
}

const crud = makeCrudRoute<RawInput, RawInput, ListQuery>({
  metadata: routeMetadata,
  orm: {
    entity: McaRenewal,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'merchant_advances:mca_renewal' },
  list: {
    schema: listSchema,
    entityId: 'merchant_advances:mca_renewal',
    fields: [
      'id', 'deal_id', 'funding_id', 'paid_in_pct', 'status', 'surfaced_at',
      'created_at', 'updated_at',
    ],
    sortFieldMap: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      surfacedAt: 'surfaced_at',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.dealId) filters.deal_id = { $eq: query.dealId }
      if (query.status) filters.status = { $eq: query.status }
      return filters
    },
    transformItem: transformRenewal,
  },
  create: {
    schema: rawBodySchema,
    mapToEntity: (input, ctx) => {
      const parsed = renewalCreateSchema.parse({ ...input, ...scopeFromContext(ctx) })
      return {
        dealId: parsed.dealId,
        fundingId: parsed.fundingId,
        merchantCompanyId: parsed.merchantCompanyId ?? null,
        paidInPct: toNullableDecimal(parsed.paidInPct) ?? '0.00',
        status: parsed.status ?? 'watching',
      }
    },
  },
  update: {
    schema: rawBodySchema,
    getId: (input) => (typeof input.id === 'string' ? input.id : ''),
    applyToEntity: (entity, input, ctx) => {
      const parsed = renewalUpdateSchema.parse({ ...input, ...scopeFromContext(ctx) })
      const renewal = entity as McaRenewal
      if (hasOwn(parsed, 'status') && parsed.status) renewal.status = parsed.status
    },
    response: () => ({ ok: true }),
  },
  del: { idFrom: 'query', softDelete: true, response: () => ({ ok: true }) },
})

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

export const openApi = createMerchantAdvancesCrudOpenApi({
  resourceName: 'McaRenewal',
  pluralName: 'McaRenewals',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(z.object({
    id: z.string().uuid().nullable(),
    dealId: z.string().uuid().nullable(),
    status: z.string().nullable(),
    paidInPct: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }).passthrough()),
  create: { schema: renewalCreateSchema, responseSchema: z.object({ id: z.string().uuid() }), description: 'Creates an MCA renewal watch record.' },
  update: { schema: renewalUpdateSchema, responseSchema: defaultOkResponseSchema, description: 'Writes renewal status (contacted, renewed, lost).' },
  del: { schema: renewalDeleteSchema, responseSchema: defaultOkResponseSchema, description: 'Soft-deletes an MCA renewal.' },
})
