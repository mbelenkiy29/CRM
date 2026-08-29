import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { McaLeadSource } from '../../data/entities'
import { leadSourceCreateSchema } from '../../data/validators'
import { toIso, toNullableDecimal, toNullableText } from '../../lib/crudScope'
import { resolveImportRequestContext, runImportGuardAfterSuccess, runImportGuards } from '../importGuards'

const logger = createLogger('merchant_advances')

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.import.manage'] },
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.import.manage'] },
}

function serializeSource(row: McaLeadSource) {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? null,
    costAmount: row.costAmount ?? null,
    costCurrency: row.costCurrency ?? null,
    isActive: row.isActive,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

export async function GET(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    const requestContext = await resolveImportRequestContext(req)
    const em = requestContext.ctx.container.resolve('em') as EntityManager
    const items = await em.find(McaLeadSource, {
      organizationId: requestContext.organizationId,
      tenantId: requestContext.tenantId,
      deletedAt: null,
    }, { orderBy: { name: 'asc' } })
    return Response.json({ items: items.map(serializeSource) })
  } catch (error) {
    if (isCrudHttpError(error)) return Response.json(error.body, { status: error.status })
    logger.error('List lead sources failed', { err: error })
    return Response.json({ error: translate('merchant_advances.errors.loadFailed', 'Could not load lead sources') }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    const requestContext = await resolveImportRequestContext(req)
    const input = leadSourceCreateSchema.parse(await req.json().catch(() => ({})))
    const guardResult = await runImportGuards(requestContext.ctx, {
      tenantId: requestContext.tenantId,
      organizationId: requestContext.organizationId,
      userId: requestContext.ctx.auth?.sub ?? '',
      resourceKind: 'merchant_advances.lead_source',
      resourceId: null,
      operation: 'create',
      requestMethod: req.method,
      requestHeaders: req.headers,
      mutationPayload: { name: input.name },
    })
    if (!guardResult.ok) {
      return Response.json(guardResult.errorBody ?? { error: translate('merchant_advances.errors.operationBlocked', 'Operation blocked by guard') }, { status: guardResult.errorStatus ?? 422 })
    }
    const em = (requestContext.ctx.container.resolve('em') as EntityManager).fork()
    const row = em.create(McaLeadSource, {
      organizationId: requestContext.organizationId,
      tenantId: requestContext.tenantId,
      name: input.name,
      code: toNullableText(input.code),
      costAmount: toNullableDecimal(input.costAmount),
      costCurrency: toNullableText(input.costCurrency),
      isActive: input.isActive ?? true,
    })
    em.persist(row)
    await em.flush()
    if (guardResult.afterSuccessCallbacks.length) {
      await runImportGuardAfterSuccess(guardResult.afterSuccessCallbacks, {
        tenantId: requestContext.tenantId,
        organizationId: requestContext.organizationId,
        userId: requestContext.ctx.auth?.sub ?? '',
        resourceKind: 'merchant_advances.lead_source',
        resourceId: row.id,
        operation: 'create',
        requestMethod: req.method,
        requestHeaders: req.headers,
      })
    }
    return Response.json({ id: row.id, item: serializeSource(row) }, { status: 201 })
  } catch (error) {
    if (isCrudHttpError(error)) return Response.json(error.body, { status: error.status })
    if (error instanceof z.ZodError) {
      return Response.json({ error: translate('merchant_advances.errors.invalidPayload', 'Invalid payload') }, { status: 400 })
    }
    logger.error('Create lead source failed', { err: error })
    return Response.json({ error: translate('merchant_advances.errors.saveFailed', 'Could not save lead source') }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Workspace-scoped MCA lead sources',
  methods: {
    GET: { summary: 'List lead sources' },
    POST: { summary: 'Create lead source', requestBody: { contentType: 'application/json', schema: leadSourceCreateSchema } },
  },
}
