import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CacheStrategy } from '@open-mercato/cache'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import {
  ScopedAttachmentUploadError,
  type ScopedAttachmentUploadService,
} from '@open-mercato/core/modules/attachments/lib/scoped-upload-service'
import { MCA_DEAL_ENTITY_ID, MCA_DEAL_RESOURCE_KIND } from '../../../commands/intake'
import { loadIntakeWorkspaceConfig } from '../../../commands/settings'
import { issueUploadTokenSchema } from '../../../data/validators'
import { McaDeal, McaDocument } from '../../../data/entities'
import { isDocumentClassification } from '../../../lib/intake/formMapper'
import { tryResolve } from '../../../lib/intake/tryResolve'
import {
  consumeUploadToken,
  issueUploadToken,
  persistUploadTokenHash,
  type IntakeUploadTokenClaims,
} from '../../../lib/intake/uploadLinks'
import { toRecord } from '../../../lib/crudScope'

const logger = createLogger('merchant_advances').child({ route: 'intake-upload' })

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.deal.manage'] },
  PUT: { requireAuth: false },
}

const ATTACHMENT_ERROR_KEYS: Partial<Record<ScopedAttachmentUploadError['code'], [string, string]>> = {
  dangerous_executable: ['attachments.errors.dangerousExecutable', 'Executable file types are not allowed as attachments.'],
  max_upload_size: ['attachments.errors.maxUploadSize', 'Attachment exceeds the maximum upload size.'],
  active_content: ['attachments.errors.activeContentBlocked', 'Active content uploads are not allowed.'],
}

async function issueToken(req: Request): Promise<Response> {
  const { translate } = await resolveTranslations()
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth?.sub || !auth.tenantId) {
    throw new CrudHttpError(401, { error: translate('merchant_advances.errors.unauthorized', 'Unauthorized') })
  }
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = scope?.selectedId ?? auth.orgId
  if (!organizationId) {
    throw new CrudHttpError(400, { error: translate('merchant_advances.errors.scopeRequired', 'Organization context is required.') })
  }
  const body = issueUploadTokenSchema.parse(toRecord(await readJsonSafe(req, {})))
  const em = (container.resolve('em') as EntityManager).fork()
  const deal = await em.findOne(McaDeal, {
    id: body.dealId,
    tenantId: auth.tenantId,
    organizationId,
    deletedAt: null,
  })
  if (!deal) {
    throw new CrudHttpError(404, { error: translate('merchant_advances.errors.dealNotFound', 'MCA deal not found.') })
  }
  const guarded = await runRouteMutationGuards({
    container,
    req,
    auth: { userId: auth.sub, tenantId: auth.tenantId, organizationId },
    input: {
      resourceKind: MCA_DEAL_RESOURCE_KIND,
      resourceId: deal.id,
      operation: 'update',
      mutationPayload: { dealId: deal.id, classification: body.classification ?? 'statement' },
    },
  })
  if (!guarded.ok) return guarded.response

  const config = await loadIntakeWorkspaceConfig(container, { tenantId: auth.tenantId, organizationId })
  if (!config.uploadLinksEnabled) {
    throw new CrudHttpError(409, {
      error: translate('merchant_advances.errors.uploadLinksDisabled', 'Merchant upload links are disabled for this workspace.'),
    })
  }
  const issued = issueUploadToken({
    dealId: deal.id,
    tenantId: auth.tenantId,
    organizationId,
    classification: body.classification ?? 'statement',
    ttlHours: config.uploadLinkTtlHours,
  })
  const cache = tryResolve<CacheStrategy>(container, 'cache')
  await persistUploadTokenHash(cache ?? null, issued)
  await guarded.runAfterSuccess()
  return NextResponse.json({
    ok: true,
    result: {
      token: issued.token,
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt.toISOString(),
      classification: issued.claims.classification,
      dealId: deal.id,
    },
  })
}

async function uploadWithToken(req: Request): Promise<Response> {
  const { translate } = await resolveTranslations()
  const container = await createRequestContainer()
  const url = new URL(req.url)
  const form = await req.formData().catch(() => null)
  const token = (form?.get('token') instanceof File ? null : String(form?.get('token') ?? ''))
    || url.searchParams.get('token')
    || req.headers.get('x-mca-upload-token')
  if (!token) {
    throw new CrudHttpError(400, { error: translate('merchant_advances.errors.uploadTokenRequired', 'An upload token is required.') })
  }
  const cache = tryResolve<CacheStrategy>(container, 'cache')
  const claims = await consumeUploadToken(cache ?? null, token)
  if (!claims) {
    throw new CrudHttpError(410, { error: translate('merchant_advances.errors.uploadTokenInvalid', 'The upload token is invalid or expired.') })
  }
  const file = form?.get('file')
  if (!(file instanceof File)) {
    throw new CrudHttpError(400, { error: translate('merchant_advances.errors.uploadFileRequired', 'A file is required.') })
  }
  return persistClassifiedUpload(container, claims, file, translate)
}

async function persistClassifiedUpload(
  container: Awaited<ReturnType<typeof createRequestContainer>>,
  claims: IntakeUploadTokenClaims,
  file: File,
  translate: (key: string, fallback?: string) => string,
): Promise<Response> {
  const em = (container.resolve('em') as EntityManager).fork()
  const deal = await em.findOne(McaDeal, {
    id: claims.dealId,
    tenantId: claims.tenantId,
    organizationId: claims.organizationId,
    deletedAt: null,
  })
  if (!deal) {
    throw new CrudHttpError(404, { error: translate('merchant_advances.errors.dealNotFound', 'MCA deal not found.') })
  }
  const uploader = tryResolve<ScopedAttachmentUploadService>(container, 'attachmentScopedUploadService')
  if (!uploader) {
    throw new CrudHttpError(503, {
      error: translate('merchant_advances.errors.uploadUnavailable', 'File uploads are unavailable.'),
    })
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  let attachment
  try {
    attachment = await uploader.upload({
      tenantId: claims.tenantId,
      organizationId: claims.organizationId,
      entityId: MCA_DEAL_ENTITY_ID,
      recordId: deal.id,
      fileName: file.name,
      declaredMimeType: file.type,
      buffer,
    })
  } catch (err) {
    if (err instanceof ScopedAttachmentUploadError) {
      const [key, fallback] = ATTACHMENT_ERROR_KEYS[err.code] ?? ['merchant_advances.errors.uploadFailed', 'Upload failed.']
      throw new CrudHttpError(err.status, { error: translate(key, fallback) })
    }
    throw err
  }

  const classification = isDocumentClassification(claims.classification) ? claims.classification : 'statement'
  const document = em.create(McaDocument, {
    organizationId: claims.organizationId,
    tenantId: claims.tenantId,
    dealId: deal.id,
    classification,
    attachmentId: attachment.id,
    isOriginal: true,
  })
  if (classification === 'statement' && deal.pipelineStatus === 'new_app') {
    deal.pipelineStatus = 'statements_in'
  }
  em.persist(document)
  await em.flush()

  return NextResponse.json({
    ok: true,
    result: {
      attachmentId: attachment.id,
      documentId: document.id,
      dealId: deal.id,
      classification,
      updatedAt: deal.updatedAt.toISOString(),
    },
  })
}

export async function POST(req: Request): Promise<Response> {
  try {
    return await issueToken(req)
  } catch (err) {
    return handleRouteError(err, 'MCA upload token issue failed')
  }
}

export async function PUT(req: Request): Promise<Response> {
  try {
    return await uploadWithToken(req)
  } catch (err) {
    return handleRouteError(err, 'MCA signed upload failed')
  }
}

async function handleRouteError(err: unknown, logMessage: string): Promise<Response> {
  const { translate } = await resolveTranslations()
  if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: translate('merchant_advances.errors.invalidIntake', 'Intake payload is invalid.') },
      { status: 400 },
    )
  }
  logger.error(logMessage, { err })
  return NextResponse.json(
    { error: translate('merchant_advances.errors.uploadFailed', 'Upload failed.') },
    { status: 500 },
  )
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Issue or consume a signed merchant upload token',
  methods: {
    POST: {
      summary: 'Issue a signed merchant upload token for an MCA deal',
      requestBody: { schema: issueUploadTokenSchema },
      responses: [
        {
          status: 200,
          description: 'Signed upload token.',
          schema: z.object({
            ok: z.literal(true),
            result: z.object({
              token: z.string(),
              tokenHash: z.string(),
              expiresAt: z.string(),
              classification: z.string(),
              dealId: z.string().uuid(),
            }),
          }),
        },
      ],
    },
    PUT: {
      summary: 'Upload a classified statement or application using a signed token',
      requestBody: {
        contentType: 'multipart/form-data',
        schema: z.object({
          token: z.string(),
          file: z.string().describe('Binary file payload'),
        }),
      },
      responses: [
        { status: 200, description: 'Attachment stored and classified.' },
        { status: 410, description: 'Token invalid or expired.' },
      ],
    },
  },
}
