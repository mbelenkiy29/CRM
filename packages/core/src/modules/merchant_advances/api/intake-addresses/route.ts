import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { McaIntakeAddress } from '../../data/entities'
import { intakeAddressCreateSchema } from '../../data/validators'
import { toIso } from '../../lib/crudScope'
import { resolveImportRequestContext, runImportGuardAfterSuccess, runImportGuards } from '../importGuards'

const logger = createLogger('merchant_advances')

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.settings.manage'] },
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.settings.manage'] },
}

function serializeAddress(row: McaIntakeAddress) {
  return {
    id: row.id,
    emailAddress: row.emailAddress,
    defaultOwnerUserId: row.defaultOwnerUserId ?? null,
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
    const items = await em.find(McaIntakeAddress, {
      organizationId: requestContext.organizationId,
      tenantId: requestContext.tenantId,
      deletedAt: null,
    }, { orderBy: { emailAddress: 'asc' } })
    return Response.json({ items: items.map(serializeAddress) })
  } catch (error) {
    if (isCrudHttpError(error)) return Response.json(error.body, { status: error.status })
    logger.error('List intake addresses failed', { err: error })
    return Response.json({ error: translate('merchant_advances.errors.loadFailed', 'Could not load intake addresses') }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    const requestContext = await resolveImportRequestContext(req)
    const input = intakeAddressCreateSchema.parse(await req.json().catch(() => ({})))
    const guardResult = await runImportGuards(requestContext.ctx, {
      tenantId: requestContext.tenantId,
      organizationId: requestContext.organizationId,
      userId: requestContext.ctx.auth?.sub ?? '',
      resourceKind: 'merchant_advances.intake_address',
      resourceId: null,
      operation: 'create',
      requestMethod: req.method,
      requestHeaders: req.headers,
      mutationPayload: { emailAddress: input.emailAddress },
    })
    if (!guardResult.ok) {
      return Response.json(guardResult.errorBody ?? { error: translate('merchant_advances.errors.operationBlocked', 'Operation blocked by guard') }, { status: guardResult.errorStatus ?? 422 })
    }
    const em = (requestContext.ctx.container.resolve('em') as EntityManager).fork()
    const row = em.create(McaIntakeAddress, {
      organizationId: requestContext.organizationId,
      tenantId: requestContext.tenantId,
      emailAddress: input.emailAddress,
      defaultOwnerUserId: input.defaultOwnerUserId ?? null,
      isActive: input.isActive ?? true,
    })
    em.persist(row)
    await em.flush()
    if (guardResult.afterSuccessCallbacks.length) {
      await runImportGuardAfterSuccess(guardResult.afterSuccessCallbacks, {
        tenantId: requestContext.tenantId,
        organizationId: requestContext.organizationId,
        userId: requestContext.ctx.auth?.sub ?? '',
        resourceKind: 'merchant_advances.intake_address',
        resourceId: row.id,
        operation: 'create',
        requestMethod: req.method,
        requestHeaders: req.headers,
      })
    }
    return Response.json({ id: row.id, item: serializeAddress(row) }, { status: 201 })
  } catch (error) {
    if (isCrudHttpError(error)) return Response.json(error.body, { status: error.status })
    if (error instanceof z.ZodError) {
      return Response.json({ error: translate('merchant_advances.errors.invalidPayload', 'Invalid payload') }, { status: 400 })
    }
    logger.error('Create intake address failed', { err: error })
    return Response.json({ error: translate('merchant_advances.errors.saveFailed', 'Could not save intake address') }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Workspace-scoped MCA intake addresses',
  methods: {
    GET: { summary: 'List intake addresses' },
    POST: { summary: 'Create intake address', requestBody: { contentType: 'application/json', schema: intakeAddressCreateSchema } },
  },
}
