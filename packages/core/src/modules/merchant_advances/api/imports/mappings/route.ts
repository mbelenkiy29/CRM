import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { McaImportMapping } from '../../../data/entities'
import { importMappingCreateSchema } from '../../../data/validators'
import { toIso } from '../../../lib/crudScope'
import { resolveImportRequestContext, runImportGuardAfterSuccess, runImportGuards } from '../../importGuards'

const logger = createLogger('merchant_advances')

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.import.manage'] },
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.import.manage'] },
}

function serializeMapping(row: McaImportMapping) {
  return {
    id: row.id,
    providerName: row.providerName,
    columnMap: row.columnMap,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

export async function GET(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    const requestContext = await resolveImportRequestContext(req)
    const em = requestContext.ctx.container.resolve('em') as EntityManager
    const items = await em.find(McaImportMapping, {
      organizationId: requestContext.organizationId,
      tenantId: requestContext.tenantId,
      deletedAt: null,
    }, { orderBy: { providerName: 'asc' } })
    return Response.json({ items: items.map(serializeMapping) })
  } catch (error) {
    if (isCrudHttpError(error)) return Response.json(error.body, { status: error.status })
    logger.error('List import mappings failed', { err: error })
    return Response.json({ error: translate('merchant_advances.errors.loadFailed', 'Could not load saved mappings') }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    const requestContext = await resolveImportRequestContext(req)
    const input = importMappingCreateSchema.parse(await req.json().catch(() => ({})))
    const guardResult = await runImportGuards(requestContext.ctx, {
      tenantId: requestContext.tenantId,
      organizationId: requestContext.organizationId,
      userId: requestContext.ctx.auth?.sub ?? '',
      resourceKind: 'merchant_advances.import_mapping',
      resourceId: null,
      operation: 'create',
      requestMethod: req.method,
      requestHeaders: req.headers,
      mutationPayload: { providerName: input.providerName },
    })
    if (!guardResult.ok) {
      return Response.json(guardResult.errorBody ?? { error: translate('merchant_advances.errors.operationBlocked', 'Operation blocked by guard') }, { status: guardResult.errorStatus ?? 422 })
    }
    const em = (requestContext.ctx.container.resolve('em') as EntityManager).fork()
    const existing = await em.findOne(McaImportMapping, {
      organizationId: requestContext.organizationId,
      tenantId: requestContext.tenantId,
      providerName: input.providerName,
      deletedAt: null,
    })
    if (existing) {
      existing.columnMap = input.columnMap
      em.persist(existing)
      await em.flush()
      return Response.json({ id: existing.id, item: serializeMapping(existing) })
    }
    const row = em.create(McaImportMapping, {
      organizationId: requestContext.organizationId,
      tenantId: requestContext.tenantId,
      providerName: input.providerName,
      columnMap: input.columnMap,
    })
    em.persist(row)
    await em.flush()
    if (guardResult.afterSuccessCallbacks.length) {
      await runImportGuardAfterSuccess(guardResult.afterSuccessCallbacks, {
        tenantId: requestContext.tenantId,
        organizationId: requestContext.organizationId,
        userId: requestContext.ctx.auth?.sub ?? '',
        resourceKind: 'merchant_advances.import_mapping',
        resourceId: row.id,
        operation: 'create',
        requestMethod: req.method,
        requestHeaders: req.headers,
      })
    }
    return Response.json({ id: row.id, item: serializeMapping(row) }, { status: 201 })
  } catch (error) {
    if (isCrudHttpError(error)) return Response.json(error.body, { status: error.status })
    if (error instanceof z.ZodError) {
      return Response.json({ error: translate('merchant_advances.errors.invalidPayload', 'Invalid payload') }, { status: 400 })
    }
    logger.error('Save import mapping failed', { err: error })
    return Response.json({ error: translate('merchant_advances.errors.saveFailed', 'Could not save mapping') }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Saved MCA import column mappings',
  methods: {
    GET: { summary: 'List saved mappings' },
    POST: { summary: 'Save mapping', requestBody: { contentType: 'application/json', schema: importMappingCreateSchema } },
  },
}
