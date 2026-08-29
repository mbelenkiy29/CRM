import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { McaOffer } from '../../data/entities'
import { offerCreateSchema, offerUpdateSchema, offerDeleteSchema } from '../../data/validators'
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
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortField: z.enum(['updatedAt', 'createdAt', 'amount']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

type ListQuery = z.infer<typeof listSchema>
type RawInput = z.infer<typeof rawBodySchema>

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.offer.view'] },
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.offer.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['merchant_advances.offer.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['merchant_advances.offer.manage'] },
}

export const metadata = routeMetadata

function transformOffer(item: unknown): unknown {
  const record = toRecord(item)
  if (!Object.keys(record).length) return item
  return {
    id: readString(record, 'id', 'id'),
    dealId: readString(record, 'deal_id', 'dealId'),
    funderId: readString(record, 'funder_id', 'funderId'),
    amount: readString(record, 'amount', 'amount'),
    factor: readString(record, 'factor', 'factor'),
    termMonths: record.term_months ?? record.termMonths ?? null,
    paymentAmount: readString(record, 'payment_amount', 'paymentAmount'),
    paymentFrequency: readString(record, 'payment_frequency', 'paymentFrequency'),
    commissionPoints: readString(record, 'commission_points', 'commissionPoints'),
    status: readString(record, 'status', 'status'),
    createdAt: toIso(record.created_at ?? record.createdAt),
    updatedAt: toIso(record.updated_at ?? record.updatedAt),
  }
}

const crud = makeCrudRoute<RawInput, RawInput, ListQuery>({
  metadata: routeMetadata,
  orm: {
    entity: McaOffer,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'merchant_advances:mca_offer' },
  list: {
    schema: listSchema,
    entityId: 'merchant_advances:mca_offer',
    fields: [
      'id', 'deal_id', 'funder_id', 'amount', 'factor', 'term_months', 'payment_amount',
      'payment_frequency', 'commission_points', 'status', 'created_at', 'updated_at',
    ],
    sortFieldMap: { createdAt: 'created_at', updatedAt: 'updated_at', amount: 'amount' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.dealId) filters.deal_id = { $eq: query.dealId }
      return filters
    },
    transformItem: transformOffer,
  },
  create: {
    schema: rawBodySchema,
    mapToEntity: (input, ctx) => {
      const parsed = offerCreateSchema.parse({ ...input, ...scopeFromContext(ctx) })
      return {
        dealId: parsed.dealId,
        submissionId: parsed.submissionId ?? null,
        funderId: parsed.funderId ?? null,
        amount: toNullableDecimal(parsed.amount),
        factor: toNullableDecimal(parsed.factor),
        termMonths: parsed.termMonths ?? null,
        paymentAmount: toNullableDecimal(parsed.paymentAmount),
        paymentFrequency: parsed.paymentFrequency ?? null,
        feesAmount: toNullableDecimal(parsed.feesAmount),
        commissionPoints: toNullableDecimal(parsed.commissionPoints),
        stips: parsed.stips ?? null,
        status: parsed.status ?? 'open',
      }
    },
  },
  update: {
    schema: rawBodySchema,
    getId: (input) => (typeof input.id === 'string' ? input.id : ''),
    applyToEntity: (entity, input, ctx) => {
      const parsed = offerUpdateSchema.parse({ ...input, ...scopeFromContext(ctx) })
      const offer = entity as McaOffer
      if (hasOwn(parsed, 'amount')) offer.amount = toNullableDecimal(parsed.amount)
      if (hasOwn(parsed, 'factor')) offer.factor = toNullableDecimal(parsed.factor)
      if (hasOwn(parsed, 'termMonths')) offer.termMonths = parsed.termMonths ?? null
      if (hasOwn(parsed, 'paymentAmount')) offer.paymentAmount = toNullableDecimal(parsed.paymentAmount)
      if (hasOwn(parsed, 'status') && parsed.status) offer.status = parsed.status
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
  resourceName: 'McaOffer',
  pluralName: 'McaOffers',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(z.object({
    id: z.string().uuid().nullable(),
    dealId: z.string().uuid().nullable(),
    amount: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }).passthrough()),
  create: { schema: offerCreateSchema, responseSchema: z.object({ id: z.string().uuid() }), description: 'Creates an MCA offer.' },
  update: { schema: offerUpdateSchema, responseSchema: defaultOkResponseSchema, description: 'Updates an MCA offer.' },
  del: { schema: offerDeleteSchema, responseSchema: defaultOkResponseSchema, description: 'Soft-deletes an MCA offer.' },
})
