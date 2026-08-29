import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { McaWorkspaceSettings } from '../../data/entities'
import {
  workspaceSettingsSaveSchema,
  workspaceSettingsUpdateSchema,
  type WorkspaceSettingsSaveInput,
} from '../../data/validators'
import {
  loadIntakeWebhookSecret,
  loadIntakeWorkspaceConfig,
  MCA_SETTINGS_RESOURCE_KIND,
  type SaveWorkspaceSettingsResult,
} from '../../commands/settings'
import { toRecord } from '../../lib/crudScope'

const logger = createLogger('merchant_advances').child({ route: 'settings' })

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.settings.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['merchant_advances.settings.manage'] },
}

type SettingsContext = {
  ctx: CommandRuntimeContext
  em: EntityManager
  tenantId: string
  organizationId: string
  userId: string
  translate: (key: string, fallback?: string) => string
}

async function resolveSettingsContext(req: Request): Promise<SettingsContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  const { translate } = await resolveTranslations()
  if (!auth?.sub || !auth.tenantId) {
    throw new CrudHttpError(401, { error: translate('merchant_advances.errors.unauthorized', 'Unauthorized') })
  }
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = scope?.selectedId ?? auth.orgId
  if (!organizationId) {
    throw new CrudHttpError(400, { error: translate('merchant_advances.errors.scopeRequired', 'Organization context is required.') })
  }
  return {
    ctx: {
      container,
      auth,
      organizationScope: scope,
      selectedOrganizationId: organizationId,
      organizationIds: scope?.filterIds ?? [organizationId],
      request: req,
    },
    em: container.resolve('em') as EntityManager,
    tenantId: auth.tenantId,
    organizationId,
    userId: auth.sub,
    translate,
  }
}

async function readSettings(context: SettingsContext) {
  const settings = await context.em.findOne(McaWorkspaceSettings, {
    tenantId: context.tenantId,
    organizationId: context.organizationId,
    deletedAt: null,
  })
  const config = await loadIntakeWorkspaceConfig(context.ctx.container, {
    tenantId: context.tenantId,
    organizationId: context.organizationId,
  })
  const secret = await loadIntakeWebhookSecret(context.ctx.container, {
    tenantId: context.tenantId,
    organizationId: context.organizationId,
  })
  return {
    id: settings?.id ?? null,
    defaultFromAddress: settings?.defaultFromAddress ?? null,
    watermarkEnabled: settings?.watermarkEnabled ?? true,
    uploadLinksEnabled: config.uploadLinksEnabled,
    uploadLinkTtlHours: config.uploadLinkTtlHours,
    intakeWebhookSecretConfigured: Boolean(secret),
    updatedAt: settings?.updatedAt?.toISOString() ?? null,
  }
}

export async function GET(req: Request): Promise<Response> {
  try {
    const context = await resolveSettingsContext(req)
    return NextResponse.json({ ok: true, result: await readSettings(context) })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    const { translate } = await resolveTranslations()
    logger.error('MCA settings load failed', { err })
    return NextResponse.json(
      { error: translate('merchant_advances.errors.settingsLoadFailed', 'Failed to load MCA settings.') },
      { status: 500 },
    )
  }
}

export async function PUT(req: Request): Promise<Response> {
  try {
    const context = await resolveSettingsContext(req)
    const parsed = workspaceSettingsUpdateSchema.parse(toRecord(await readJsonSafe(req, {})))
    const existing = await context.em.findOne(McaWorkspaceSettings, {
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      deletedAt: null,
    })
    const guarded = await runRouteMutationGuards({
      container: context.ctx.container,
      req,
      auth: { userId: context.userId, tenantId: context.tenantId, organizationId: context.organizationId },
      input: {
        resourceKind: MCA_SETTINGS_RESOURCE_KIND,
        resourceId: existing?.id ?? null,
        operation: existing ? 'update' : 'create',
        mutationPayload: { ...parsed },
      },
    })
    if (!guarded.ok) return guarded.response
    const commandInput = workspaceSettingsSaveSchema.parse(
      withScopedPayload({ ...parsed, ...guarded.modifiedPayload }, context.ctx, context.translate),
    )
    const commandBus = context.ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<WorkspaceSettingsSaveInput, SaveWorkspaceSettingsResult>(
      'merchant_advances.settings.save',
      { input: commandInput, ctx: context.ctx },
    )
    await guarded.runAfterSuccess()
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      const { translate } = await resolveTranslations()
      return NextResponse.json(
        { error: translate('merchant_advances.errors.invalidIntake', 'Intake payload is invalid.') },
        { status: 400 },
      )
    }
    const { translate } = await resolveTranslations()
    logger.error('MCA settings save failed', { err })
    return NextResponse.json(
      { error: translate('merchant_advances.errors.settingsSaveFailed', 'Failed to save MCA settings.') },
      { status: 500 },
    )
  }
}

const settingsResultSchema = z.object({
  defaultFromAddress: z.string().nullable(),
  watermarkEnabled: z.boolean(),
  uploadLinksEnabled: z.boolean(),
  uploadLinkTtlHours: z.number(),
  intakeWebhookSecretConfigured: z.boolean(),
  updatedAt: z.string().nullable(),
}).passthrough()

export const openApi: OpenApiRouteDoc = {
  GET: {
    path: '/merchant_advances/settings',
    summary: 'Load MCA workspace intake and assignment settings',
    tags: ['Merchant Advances'],
    responses: {
      200: { description: 'Workspace settings.', content: { 'application/json': { schema: z.object({ ok: z.literal(true), result: settingsResultSchema }) } } },
    },
  },
  PUT: {
    path: '/merchant_advances/settings',
    summary: 'Update MCA workspace intake and assignment settings',
    tags: ['Merchant Advances'],
    request: { body: { content: { 'application/json': { schema: workspaceSettingsUpdateSchema } } } },
    responses: {
      200: { description: 'Settings saved.', content: { 'application/json': { schema: z.object({ ok: z.literal(true), result: settingsResultSchema }) } } },
    },
  },
}
