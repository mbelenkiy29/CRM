import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { McaFunderMatch } from '../../data/entities'
import {
  createMerchantAdvancesCrudOpenApi,
  createPagedListResponseSchema,
} from '../openapi'
import {
  rawBodySchema,
  readNumber,
  readString,
  toIso,
  toRecord,
} from '../../lib/crudScope'

const uuid = z.string().uuid()
const listSchema = z.object({
  id: uuid.optional(),
  dealId: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortField: z.enum(['rank', 'score', 'updatedAt', 'createdAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

type ListQuery = z.infer<typeof listSchema>
type RawInput = z.infer<typeof rawBodySchema>

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.deal.view'] },
}

export const metadata = routeMetadata

function transformMatch(item: unknown): unknown {
  const record = toRecord(item)
  if (!Object.keys(record).length) return item
  return {
    id: readString(record, 'id', 'id'),
    dealId: readString(record, 'deal_id', 'dealId'),
    funderId: readString(record, 'funder_id', 'funderId'),
    score: readString(record, 'score', 'score'),
    reasons: record.reasons ?? null,
    rank: readNumber(record, 'rank', 'rank'),
    createdAt: toIso(record.created_at ?? record.createdAt),
    updatedAt: toIso(record.updated_at ?? record.updatedAt),
  }
}

const crud = makeCrudRoute<RawInput, RawInput, ListQuery>({
  metadata: routeMetadata,
  orm: {
    entity: McaFunderMatch,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'merchant_advances:mca_funder_match' },
  list: {
    schema: listSchema,
    entityId: 'merchant_advances:mca_funder_match',
    fields: [
      'id', 'deal_id', 'funder_id', 'score', 'reasons', 'rank', 'created_at', 'updated_at',
    ],
    sortFieldMap: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      score: 'score',
      rank: 'rank',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.dealId) filters.deal_id = { $eq: query.dealId }
      return filters
    },
    transformItem: transformMatch,
  },
})

export const GET = crud.GET

export const openApi = createMerchantAdvancesCrudOpenApi({
  resourceName: 'McaFunderMatch',
  pluralName: 'McaFunderMatches',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(z.object({
    id: z.string().uuid().nullable(),
    dealId: z.string().uuid().nullable(),
    funderId: z.string().uuid().nullable(),
    score: z.string().nullable(),
    rank: z.number().nullable(),
    updatedAt: z.string().nullable(),
  }).passthrough()),
})
