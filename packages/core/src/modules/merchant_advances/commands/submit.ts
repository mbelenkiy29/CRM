import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { submitSendSchema, type SubmitSendInput } from '../data/validators'
import { sendDealToFunders } from '../lib/submit/send'

const SUBMIT_COMMAND_ID = 'merchant_advances.submissions.send'

const sendSubmissionsCommand: CommandHandler<SubmitSendInput, Awaited<ReturnType<typeof sendDealToFunders>>> = {
  id: SUBMIT_COMMAND_ID,
  async execute(rawInput, ctx) {
    const parsed = submitSendSchema.parse(rawInput)
    const organizationId = parsed.organizationId ?? ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    const tenantId = parsed.tenantId ?? ctx.auth?.tenantId ?? null
    if (!organizationId || !tenantId) {
      throw new CrudHttpError(400, { error: '[internal] merchant advances scope is missing' })
    }
    ensureTenantScope(ctx, tenantId)
    ensureOrganizationScope(ctx, organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    try {
      return await sendDealToFunders(em, {
        dealId: parsed.dealId,
        funderIds: parsed.funderIds,
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

registerCommand(sendSubmissionsCommand)
