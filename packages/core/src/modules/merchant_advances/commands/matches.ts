import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { matchRefreshSchema, type MatchRefreshInput } from '../data/validators'
import { refreshFunderMatches } from '../lib/matchRefresh'

const MATCH_COMMAND_ID = 'merchant_advances.matches.refresh'

const refreshMatchesCommand: CommandHandler<MatchRefreshInput, Awaited<ReturnType<typeof refreshFunderMatches>>> = {
  id: MATCH_COMMAND_ID,
  async execute(rawInput, ctx) {
    const parsed = matchRefreshSchema.parse(rawInput)
    const organizationId = parsed.organizationId ?? ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    const tenantId = parsed.tenantId ?? ctx.auth?.tenantId ?? null
    if (!organizationId || !tenantId) {
      throw new CrudHttpError(400, { error: '[internal] merchant advances scope is missing' })
    }
    ensureTenantScope(ctx, tenantId)
    ensureOrganizationScope(ctx, organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    try {
      return await refreshFunderMatches(em, {
        dealId: parsed.dealId,
        organizationId,
        tenantId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('deal not found')) {
        const { translate } = await resolveTranslations()
        throw new CrudHttpError(404, {
          error: translate('merchant_advances.errors.dealNotFound', 'Deal not found.'),
        })
      }
      throw error
    }
  },
}

registerCommand(refreshMatchesCommand)
