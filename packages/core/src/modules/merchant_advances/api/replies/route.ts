import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { McaFunderReply } from '../../data/entities'
import { replyCreateSchema, replyUpdateSchema, replyDeleteSchema } from '../../data/validators'
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
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortField: z.enum(['updatedAt', 'createdAt']).optional(),
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

function transformReply(item: unknown): unknown {
  const record = toRecord(item)
  if (!Object.keys(record).length) return item
  return {
    id: readString(record, 'id', 'id'),
    dealId: readString(record, 'deal_id', 'dealId'),
    submissionId: readString(record, 'submission_id', 'submissionId'),
    rawSource: readString(record, 'raw_source', 'rawSource'),
    classification: readString(record, 'classification', 'classification'),
    rawBody: readString(record, 'raw_body', 'rawBody'),
    parsedPayload: record.parsed_payload ?? record.parsedPayload ?? null,
    createdAt: toIso(record.created_at ?? record.createdAt),
    updatedAt: toIso(record.updated_at ?? record.updatedAt),
  }
}

const crud = makeCrudRoute<RawInput, RawInput, ListQuery>({
  metadata: routeMetadata,
  orm: {
    entity: McaFunderReply,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'merchant_advances:mca_funder_reply' },
  list: {
    schema: listSchema,
    entityId: 'merchant_advances:mca_funder_reply',
    fields: [
      'id', 'deal_id', 'submission_id', 'raw_source', 'classification', 'raw_body',
      'parsed_payload', 'created_at', 'updated_at',
    ],
    sortFieldMap: { createdAt: 'created_at', updatedAt: 'updated_at' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.dealId) filters.deal_id = { $eq: query.dealId }
      return filters
    },
    transformItem: transformReply,
  },
  create: {
    schema: rawBodySchema,
    mapToEntity: (input, ctx) => {
      const parsed = replyCreateSchema.parse({ ...input, ...scopeFromContext(ctx) })
      return {
        dealId: parsed.dealId,
        submissionId: parsed.submissionId ?? null,
        rawSource: parsed.rawSource ?? 'manual',
        classification: parsed.classification ?? 'other',
        rawBody: toNullableText(parsed.rawBody),
        parsedPayload: parsed.parsedPayload ?? null,
      }
    },
  },
  update: {
    schema: rawBodySchema,
    getId: (input) => (typeof input.id === 'string' ? input.id : ''),
    applyToEntity: (entity, input, ctx) => {
      const parsed = replyUpdateSchema.parse({ ...input, ...scopeFromContext(ctx) })
      const reply = entity as McaFunderReply
      if (hasOwn(parsed, 'classification') && parsed.classification) reply.classification = parsed.classification
      if (hasOwn(parsed, 'rawBody')) reply.rawBody = toNullableText(parsed.rawBody)
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
  resourceName: 'McaFunderReply',
  pluralName: 'McaFunderReplies',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(z.object({
    id: z.string().uuid().nullable(),
    dealId: z.string().uuid().nullable(),
    classification: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }).passthrough()),
  create: { schema: replyCreateSchema, responseSchema: z.object({ id: z.string().uuid() }), description: 'Pastes a manual funder reply onto a deal.' },
  update: { schema: replyUpdateSchema, responseSchema: defaultOkResponseSchema, description: 'Updates a funder reply.' },
  del: { schema: replyDeleteSchema, responseSchema: defaultOkResponseSchema, description: 'Soft-deletes a funder reply.' },
})
