import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { buildIlikeTerm } from '@open-mercato/shared/lib/db/buildIlikeTerm'
import { McaFunder } from '../../data/entities'
import { funderCreateSchema, funderUpdateSchema, funderDeleteSchema } from '../../data/validators'
import {
  createMerchantAdvancesCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'
import {
  hasOwn,
  rawBodySchema,
  readBool,
  readString,
  scopeFromContext,
  toIso,
  toNullableText,
  toRecord,
} from '../../lib/crudScope'

const uuid = z.string().uuid()
const listSchema = z.object({
  id: uuid.optional(),
  search: z.string().trim().max(300).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortField: z.enum(['name', 'updatedAt', 'createdAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

type ListQuery = z.infer<typeof listSchema>
type RawInput = z.infer<typeof rawBodySchema>

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.funder.view'] },
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.funder.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['merchant_advances.funder.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['merchant_advances.funder.manage'] },
}

export const metadata = routeMetadata

function transformFunder(item: unknown): unknown {
  const record = toRecord(item)
  if (!Object.keys(record).length) return item
  return {
    id: readString(record, 'id', 'id'),
    name: readString(record, 'name', 'name'),
    code: readString(record, 'code', 'code'),
    submitMethod: readString(record, 'submit_method', 'submitMethod'),
    submitEmail: readString(record, 'submit_email', 'submitEmail'),
    portalUrl: readString(record, 'portal_url', 'portalUrl'),
    webhookUrl: readString(record, 'webhook_url', 'webhookUrl'),
    isActive: readBool(record, 'is_active', 'isActive', true),
    requiresUnstampedStatements: readBool(record, 'requires_unstamped_statements', 'requiresUnstampedStatements'),
    criteria: record.criteria ?? null,
    createdAt: toIso(record.created_at ?? record.createdAt),
    updatedAt: toIso(record.updated_at ?? record.updatedAt),
  }
}

const crud = makeCrudRoute<RawInput, RawInput, ListQuery>({
  metadata: routeMetadata,
  orm: {
    entity: McaFunder,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'merchant_advances:mca_funder' },
  list: {
    schema: listSchema,
    entityId: 'merchant_advances:mca_funder',
    fields: ['id', 'name', 'code', 'submit_method', 'submit_email', 'portal_url', 'webhook_url', 'is_active', 'requires_unstamped_statements', 'criteria', 'created_at', 'updated_at'],
    sortFieldMap: { name: 'name', createdAt: 'created_at', updatedAt: 'updated_at' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.search) {
        const pattern = buildIlikeTerm(query.search)
        filters.$or = [{ name: { $ilike: pattern } }, { code: { $ilike: pattern } }]
      }
      return filters
    },
    transformItem: transformFunder,
  },
  create: {
    schema: rawBodySchema,
    mapToEntity: (input, ctx) => {
      const parsed = funderCreateSchema.parse({ ...input, ...scopeFromContext(ctx) })
      const submitMethod = parsed.route === 'api_deferred' ? 'api' : (parsed.submitMethod ?? parsed.route ?? 'email')
      const criteria = {
        ...(parsed.criteria ?? {}),
        ...(parsed.fromAddressOverride ? { fromAddressOverride: parsed.fromAddressOverride } : {}),
      }
      return {
        name: parsed.name,
        code: toNullableText(parsed.code),
        submitMethod: submitMethod === 'api_deferred' ? 'api' : submitMethod,
        submitEmail: toNullableText(parsed.submitEmail),
        portalUrl: toNullableText(parsed.portalUrl),
        webhookUrl: toNullableText(parsed.webhookUrl),
        apiProviderKey: toNullableText(parsed.apiProviderKey),
        requiresUnstampedStatements: parsed.requiresUnstampedStatements === true,
        supportsStatusPoll: false,
        criteria: Object.keys(criteria).length ? criteria : null,
        isActive: parsed.isActive !== false,
      }
    },
  },
  update: {
    schema: rawBodySchema,
    getId: (input) => (typeof input.id === 'string' ? input.id : ''),
    applyToEntity: (entity, input, ctx) => {
      const parsed = funderUpdateSchema.parse({ ...input, ...scopeFromContext(ctx) })
      const funder = entity as McaFunder
      if (hasOwn(parsed, 'name') && parsed.name) funder.name = parsed.name
      if (hasOwn(parsed, 'code')) funder.code = toNullableText(parsed.code)
      if (hasOwn(parsed, 'submitMethod') && parsed.submitMethod) funder.submitMethod = parsed.submitMethod
      if (hasOwn(parsed, 'submitEmail')) funder.submitEmail = toNullableText(parsed.submitEmail)
      if (hasOwn(parsed, 'isActive')) funder.isActive = parsed.isActive !== false
      if (hasOwn(parsed, 'requiresUnstampedStatements')) {
        funder.requiresUnstampedStatements = parsed.requiresUnstampedStatements === true
      }
      if (hasOwn(parsed, 'criteria')) funder.criteria = parsed.criteria ?? null
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
  resourceName: 'McaFunder',
  pluralName: 'McaFunders',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(z.object({
    id: z.string().uuid().nullable(),
    name: z.string().nullable(),
    submitMethod: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }).passthrough()),
  create: { schema: funderCreateSchema, responseSchema: z.object({ id: z.string().uuid() }), description: 'Creates an MCA funder.' },
  update: { schema: funderUpdateSchema, responseSchema: defaultOkResponseSchema, description: 'Updates an MCA funder.' },
  del: { schema: funderDeleteSchema, responseSchema: defaultOkResponseSchema, description: 'Soft-deletes an MCA funder.' },
})
