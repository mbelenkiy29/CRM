import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { replyInboundSchema, type ReplyInboundInput } from '../data/validators'
import { ingestInboundReply } from '../lib/replies/ingest'

const INGEST_COMMAND_ID = 'merchant_advances.replies.ingest'

const ingestReplyCommand: CommandHandler<ReplyInboundInput, Awaited<ReturnType<typeof ingestInboundReply>>> = {
  id: INGEST_COMMAND_ID,
  async execute(rawInput, ctx) {
    const parsed = replyInboundSchema.parse(rawInput)
    const organizationId = parsed.organizationId ?? ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    const tenantId = parsed.tenantId ?? ctx.auth?.tenantId ?? null
    if (!organizationId || !tenantId) {
      throw new CrudHttpError(400, { error: '[internal] merchant advances scope is missing' })
    }
    ensureTenantScope(ctx, tenantId)
    ensureOrganizationScope(ctx, organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const result = await ingestInboundReply(em, {
      ...parsed,
      organizationId,
      tenantId,
    })
    if (result.unmatched) {
      const { translate } = await resolveTranslations()
      throw new CrudHttpError(422, {
        error: translate('merchant_advances.errors.unmatchedReply', 'Inbound reply did not match a recent submission.'),
      })
    }
    return result
  },
}

registerCommand(ingestReplyCommand)
