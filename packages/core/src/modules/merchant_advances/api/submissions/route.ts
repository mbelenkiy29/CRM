import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { McaSubmission } from '../../data/entities'
import { submissionCreateSchema, submissionUpdateSchema, submissionDeleteSchema } from '../../data/validators'
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
  toNullableText,
  toRecord,
} from '../../lib/crudScope'

const uuid = z.string().uuid()
const listSchema = z.object({
  id: uuid.optional(),
  dealId: uuid.optional(),
  funderId: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortField: z.enum(['updatedAt', 'createdAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

type ListQuery = z.infer<typeof listSchema>
type RawInput = z.infer<typeof rawBodySchema>

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.submission.view'] },
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.submission.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['merchant_advances.submission.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['merchant_advances.submission.manage'] },
}

export const metadata = routeMetadata

function transformSubmission(item: unknown): unknown {
  const record = toRecord(item)
  if (!Object.keys(record).length) return item
  return {
    id: readString(record, 'id', 'id'),
    dealId: readString(record, 'deal_id', 'dealId'),
    funderId: readString(record, 'funder_id', 'funderId'),
    method: readString(record, 'method', 'method'),
    status: readString(record, 'status', 'status'),
    funderReference: readString(record, 'funder_reference', 'funderReference'),
    declineReason: readString(record, 'decline_reason', 'declineReason'),
    createdAt: toIso(record.created_at ?? record.createdAt),
    updatedAt: toIso(record.updated_at ?? record.updatedAt),
  }
}

const crud = makeCrudRoute<RawInput, RawInput, ListQuery>({
  metadata: routeMetadata,
  orm: {
    entity: McaSubmission,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'merchant_advances:mca_submission' },
  list: {
    schema: listSchema,
    entityId: 'merchant_advances:mca_submission',
    fields: [
      'id', 'deal_id', 'funder_id', 'method', 'status', 'funder_reference',
      'decline_reason', 'created_at', 'updated_at',
    ],
    sortFieldMap: { createdAt: 'created_at', updatedAt: 'updated_at' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.dealId) filters.deal_id = { $eq: query.dealId }
      if (query.funderId) filters.funder_id = { $eq: query.funderId }
      return filters
    },
    transformItem: transformSubmission,
  },
  create: {
    schema: rawBodySchema,
    mapToEntity: (input, ctx) => {
      const parsed = submissionCreateSchema.parse({ ...input, ...scopeFromContext(ctx) })
      return {
        dealId: parsed.dealId,
        funderId: parsed.funderId,
        method: parsed.method ?? 'email',
        status: parsed.status ?? 'draft',
        funderReference: toNullableText(parsed.funderReference),
        declineReason: toNullableText(parsed.declineReason),
        sentFromAddress: toNullableText(parsed.sentFromAddress),
      }
    },
  },
  update: {
    schema: rawBodySchema,
    getId: (input) => (typeof input.id === 'string' ? input.id : ''),
    applyToEntity: (entity, input, ctx) => {
      const parsed = submissionUpdateSchema.parse({ ...input, ...scopeFromContext(ctx) })
      const submission = entity as McaSubmission
      if (hasOwn(parsed, 'status') && parsed.status) submission.status = parsed.status
      if (hasOwn(parsed, 'funderReference')) submission.funderReference = toNullableText(parsed.funderReference)
      if (hasOwn(parsed, 'declineReason')) submission.declineReason = toNullableText(parsed.declineReason)
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
  resourceName: 'McaSubmission',
  pluralName: 'McaSubmissions',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(z.object({
    id: z.string().uuid().nullable(),
    dealId: z.string().uuid().nullable(),
    status: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }).passthrough()),
  create: { schema: submissionCreateSchema, responseSchema: z.object({ id: z.string().uuid() }), description: 'Creates an MCA submission record.' },
  update: { schema: submissionUpdateSchema, responseSchema: defaultOkResponseSchema, description: 'Updates an MCA submission.' },
  del: { schema: submissionDeleteSchema, responseSchema: defaultOkResponseSchema, description: 'Soft-deletes an MCA submission.' },
})
