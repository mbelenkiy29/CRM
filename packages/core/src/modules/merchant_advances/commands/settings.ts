import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { enforceCommandOptimisticLockWithGuards } from '@open-mercato/shared/lib/crud/optimistic-lock-command'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { McaWorkspaceSettings } from '../data/entities'
import { workspaceSettingsSaveSchema, type WorkspaceSettingsSaveInput } from '../data/validators'
import { tryResolve } from '../lib/intake/tryResolve'
import {
  MCA_DEFAULT_UPLOAD_TTL_HOURS,
  resolveUploadTtlHours,
} from '../lib/intake/uploadLinks'

export const MCA_SETTINGS_RESOURCE_KIND = 'merchant_advances.settings'
export const MCA_CONFIG_UPLOAD_LINKS = 'intake.uploadLinks'
export const MCA_CONFIG_INTAKE_SECRET = 'intake.webhookSecret'

export type IntakeWorkspaceConfig = {
  uploadLinksEnabled: boolean
  uploadLinkTtlHours: number
}

export type SaveWorkspaceSettingsResult = {
  settingsId: string
  defaultFromAddress: string | null
  watermarkEnabled: boolean
  uploadLinksEnabled: boolean
  uploadLinkTtlHours: number
  intakeWebhookSecretConfigured: boolean
  updatedAt: string
}

function parseInput(raw: unknown): WorkspaceSettingsSaveInput {
  const parsed = workspaceSettingsSaveSchema.safeParse(raw)
  if (!parsed.success) {
    throw new CrudHttpError(400, { error: '[internal] MCA workspace settings input is invalid' })
  }
  return parsed.data
}

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key)
}

export async function loadIntakeWorkspaceConfig(
  resolver: { resolve: <T = unknown>(name: string) => T },
  scope: { tenantId: string; organizationId: string },
): Promise<IntakeWorkspaceConfig> {
  const service = tryResolve<ModuleConfigService>(resolver, 'moduleConfigService')
  const stored = service
    ? await service.getValue<Partial<IntakeWorkspaceConfig>>(
      'merchant_advances',
      MCA_CONFIG_UPLOAD_LINKS,
      { scope },
    )
    : null
  return {
    uploadLinksEnabled: stored?.uploadLinksEnabled !== false,
    uploadLinkTtlHours: resolveUploadTtlHours(stored?.uploadLinkTtlHours ?? MCA_DEFAULT_UPLOAD_TTL_HOURS),
  }
}

export async function loadIntakeWebhookSecret(
  resolver: { resolve: <T = unknown>(name: string) => T },
  scope: { tenantId: string; organizationId: string },
): Promise<string | null> {
  const service = tryResolve<ModuleConfigService>(resolver, 'moduleConfigService')
  if (!service) return null
  const value = await service.getValue<string>('merchant_advances', MCA_CONFIG_INTAKE_SECRET, { scope })
  return typeof value === 'string' && value.trim() ? value : null
}

const saveSettingsCommand: CommandHandler<WorkspaceSettingsSaveInput, SaveWorkspaceSettingsResult> = {
  id: 'merchant_advances.settings.save',
  async execute(rawInput, ctx) {
    const input = parseInput(rawInput)
    ensureTenantScope(ctx, input.tenantId)
    ensureOrganizationScope(ctx, input.organizationId)
    const scope = { tenantId: input.tenantId, organizationId: input.organizationId }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let settings = await em.findOne(McaWorkspaceSettings, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    })
    if (!settings) {
      settings = em.create(McaWorkspaceSettings, {
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      })
      em.persist(settings)
    } else {
      await enforceCommandOptimisticLockWithGuards(ctx.container, {
        resourceKind: MCA_SETTINGS_RESOURCE_KIND,
        resourceId: settings.id,
        current: settings.updatedAt,
        request: ctx.request ?? null,
      })
    }
    if (hasOwn(input, 'defaultFromAddress')) settings.defaultFromAddress = input.defaultFromAddress ?? null
    if (hasOwn(input, 'watermarkEnabled') && input.watermarkEnabled !== undefined) {
      settings.watermarkEnabled = input.watermarkEnabled
    }
    await em.flush()

    const configService = tryResolve<ModuleConfigService>(ctx.container, 'moduleConfigService')
    const currentConfig = await loadIntakeWorkspaceConfig(ctx.container, scope)
    if (configService) {
      await configService.setValue(
        'merchant_advances',
        MCA_CONFIG_UPLOAD_LINKS,
        {
          uploadLinksEnabled: input.uploadLinksEnabled ?? currentConfig.uploadLinksEnabled,
          uploadLinkTtlHours: resolveUploadTtlHours(input.uploadLinkTtlHours ?? currentConfig.uploadLinkTtlHours),
        },
        scope,
      )
      if (hasOwn(input, 'intakeWebhookSecret') && input.intakeWebhookSecret !== undefined) {
        await configService.setValue(
          'merchant_advances',
          MCA_CONFIG_INTAKE_SECRET,
          input.intakeWebhookSecret,
          scope,
        )
      }
    }

    const nextConfig = await loadIntakeWorkspaceConfig(ctx.container, scope)
    const secret = await loadIntakeWebhookSecret(ctx.container, scope)
    return {
      settingsId: settings.id,
      defaultFromAddress: settings.defaultFromAddress ?? null,
      watermarkEnabled: settings.watermarkEnabled,
      uploadLinksEnabled: nextConfig.uploadLinksEnabled,
      uploadLinkTtlHours: nextConfig.uploadLinkTtlHours,
      intakeWebhookSecretConfigured: Boolean(secret),
      updatedAt: settings.updatedAt.toISOString(),
    }
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('merchant_advances.audit.settingsSave', 'Save MCA workspace settings'),
      resourceKind: MCA_SETTINGS_RESOURCE_KIND,
      resourceId: result.settingsId,
    }
  },
}

registerCommand(saveSettingsCommand)
