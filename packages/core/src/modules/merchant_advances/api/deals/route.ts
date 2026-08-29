import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { buildIlikeTerm } from '@open-mercato/shared/lib/db/buildIlikeTerm'
import { McaDeal } from '../../data/entities'
import { dealCreateSchema, dealUpdateSchema, dealDeleteSchema } from '../../data/validators'
import {
  createMerchantAdvancesCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'
import {
  hasOwn,
  rawBodySchema,
  readNumber,
  readString,
  scopeFromContext,
  toIso,
  toNullableDecimal,
  toNullableText,
  toRecord,
} from '../../lib/crudScope'

const uuid = z.string().uuid()
const listSchema = z.object({
  id: uuid.optional(),
  search: z.string().trim().max(300).optional(),
  pipelineStatus: z.string().optional(),
  ownerUserId: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortField: z.enum(['businessName', 'updatedAt', 'createdAt', 'requestedAmount']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

type ListQuery = z.infer<typeof listSchema>
type RawInput = z.infer<typeof rawBodySchema>

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.deal.view'] },
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.deal.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['merchant_advances.deal.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['merchant_advances.deal.manage'] },
}

export const metadata = routeMetadata

function transformDeal(item: unknown): unknown {
  const record = toRecord(item)
  if (!Object.keys(record).length) return item
  return {
    id: readString(record, 'id', 'id'),
    organizationId: readString(record, 'organization_id', 'organizationId'),
    tenantId: readString(record, 'tenant_id', 'tenantId'),
    businessName: readString(record, 'business_name', 'businessName'),
    merchantCompanyId: readString(record, 'merchant_company_id', 'merchantCompanyId'),
    merchantNameSnapshot: readString(record, 'merchant_name_snapshot', 'merchantNameSnapshot'),
    ownerUserId: readString(record, 'owner_user_id', 'ownerUserId'),
    pipelineStatus: readString(record, 'pipeline_status', 'pipelineStatus'),
    requestedAmount: readString(record, 'requested_amount', 'requestedAmount'),
    avgMonthlyRevenue: readString(record, 'avg_monthly_revenue', 'avgMonthlyRevenue'),
    timeInBusinessMonths: readNumber(record, 'time_in_business_months', 'timeInBusinessMonths'),
    position: readNumber(record, 'position', 'position'),
    industry: readString(record, 'industry', 'industry'),
    state: readString(record, 'state', 'state'),
    leadSourceId: readString(record, 'lead_source_id', 'leadSourceId'),
    assignmentMethod: readString(record, 'assignment_method', 'assignmentMethod'),
    createdAt: toIso(record.created_at ?? record.createdAt),
    updatedAt: toIso(record.updated_at ?? record.updatedAt),
  }
}

const crud = makeCrudRoute<RawInput, RawInput, ListQuery>({
  metadata: routeMetadata,
  orm: {
    entity: McaDeal,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'merchant_advances:mca_deal' },
  list: {
    schema: listSchema,
    entityId: 'merchant_advances:mca_deal',
    fields: [
      'id',
      'organization_id',
      'tenant_id',
      'business_name',
      'merchant_company_id',
      'merchant_name_snapshot',
      'owner_user_id',
      'pipeline_status',
      'requested_amount',
      'avg_monthly_revenue',
      'time_in_business_months',
      'position',
      'industry',
      'state',
      'lead_source_id',
      'assignment_method',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      businessName: 'business_name',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      requestedAmount: 'requested_amount',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.pipelineStatus) filters.pipeline_status = { $eq: query.pipelineStatus }
      if (query.ownerUserId) filters.owner_user_id = { $eq: query.ownerUserId }
      if (query.search) {
        const pattern = buildIlikeTerm(query.search)
        filters.$or = [{ business_name: { $ilike: pattern } }, { industry: { $ilike: pattern } }]
      }
      return filters
    },
    transformItem: transformDeal,
  },
  create: {
    schema: rawBodySchema,
    mapToEntity: (input, ctx) => {
      const parsed = dealCreateSchema.parse({ ...input, ...scopeFromContext(ctx) })
      return {
        businessName: parsed.businessName,
        merchantCompanyId: parsed.merchantCompanyId ?? null,
        merchantNameSnapshot: toNullableText(parsed.merchantNameSnapshot ?? parsed.businessName),
        merchantStateSnapshot: toNullableText(parsed.merchantStateSnapshot),
        primaryPersonId: parsed.primaryPersonId ?? null,
        customerDealId: parsed.customerDealId ?? null,
        ownerUserId: parsed.ownerUserId ?? null,
        pipelineStatus: parsed.pipelineStatus ?? 'new_app',
        requestedAmount: toNullableDecimal(parsed.requestedAmount),
        avgMonthlyRevenue: toNullableDecimal(parsed.avgMonthlyRevenue),
        timeInBusinessMonths: parsed.timeInBusinessMonths ?? null,
        position: parsed.position ?? null,
        industry: toNullableText(parsed.industry),
        state: toNullableText(parsed.state),
        ein: toNullableText(parsed.ein),
        legalAddress: toNullableText(parsed.legalAddress),
        startDate: parsed.startDate ? new Date(parsed.startDate) : null,
        leadSourceId: parsed.leadSourceId ?? null,
        leadBatchId: parsed.leadBatchId ?? null,
        assignmentMethod: parsed.assignmentMethod ?? 'manual',
      }
    },
  },
  update: {
    schema: rawBodySchema,
    getId: (input) => (typeof input.id === 'string' ? input.id : ''),
    applyToEntity: (entity, input, ctx) => {
      const parsed = dealUpdateSchema.parse({ ...input, ...scopeFromContext(ctx) })
      const deal = entity as McaDeal
      if (hasOwn(parsed, 'businessName') && parsed.businessName) deal.businessName = parsed.businessName
      if (hasOwn(parsed, 'ownerUserId')) deal.ownerUserId = parsed.ownerUserId ?? null
      if (hasOwn(parsed, 'pipelineStatus') && parsed.pipelineStatus) deal.pipelineStatus = parsed.pipelineStatus
      if (hasOwn(parsed, 'requestedAmount')) deal.requestedAmount = toNullableDecimal(parsed.requestedAmount)
      if (hasOwn(parsed, 'avgMonthlyRevenue')) deal.avgMonthlyRevenue = toNullableDecimal(parsed.avgMonthlyRevenue)
      if (hasOwn(parsed, 'timeInBusinessMonths')) deal.timeInBusinessMonths = parsed.timeInBusinessMonths ?? null
      if (hasOwn(parsed, 'position')) deal.position = parsed.position ?? null
      if (hasOwn(parsed, 'industry')) deal.industry = toNullableText(parsed.industry)
      if (hasOwn(parsed, 'state')) deal.state = toNullableText(parsed.state)
      if (hasOwn(parsed, 'ein')) deal.ein = toNullableText(parsed.ein)
      if (hasOwn(parsed, 'legalAddress')) deal.legalAddress = toNullableText(parsed.legalAddress)
      if (hasOwn(parsed, 'leadSourceId')) deal.leadSourceId = parsed.leadSourceId ?? null
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
  resourceName: 'McaDeal',
  pluralName: 'McaDeals',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(z.object({
    id: z.string().uuid().nullable(),
    businessName: z.string().nullable(),
    pipelineStatus: z.string().nullable(),
    requestedAmount: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }).passthrough()),
  create: { schema: dealCreateSchema, responseSchema: z.object({ id: z.string().uuid() }), description: 'Creates an MCA deal.' },
  update: { schema: dealUpdateSchema, responseSchema: defaultOkResponseSchema, description: 'Updates an MCA deal.' },
  del: { schema: dealDeleteSchema, responseSchema: defaultOkResponseSchema, description: 'Soft-deletes an MCA deal.' },
})
