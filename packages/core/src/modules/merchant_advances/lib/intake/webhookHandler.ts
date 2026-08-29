import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { WebhookHandler } from '@open-mercato/shared/lib/webhooks'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { mapFormPayload } from './formMapper'
import { executeDealIntake } from './executeIntake'
import { tryResolve } from './tryResolve'
import type { IntakeFormProvider } from './formMapper'

const logger = createLogger('merchant_advances').child({ component: 'intake-webhook-handler' })

const SOURCE_TO_PROVIDER: Record<string, IntakeFormProvider> = {
  mca_jotform: 'jotform',
  mca_gohighlevel: 'gohighlevel',
  mca_zoho: 'zoho',
  mca_custom: 'custom',
}

const handler: WebhookHandler = async (payload, ctx) => {
  const commandBus = tryResolve<CommandBus>(ctx, 'commandBus')
  if (!commandBus) {
    logger.warn('Skipping MCA intake webhook because commandBus is unavailable')
    return
  }
  const provider = SOURCE_TO_PROVIDER[payload.sourceKey] ?? 'custom'
  const mapped = mapFormPayload(provider, payload.data)
  const commandCtx: CommandRuntimeContext = {
    container: ctx as CommandRuntimeContext['container'],
    auth: {
      sub: 'system:mca-intake',
      tenantId: payload.tenantId,
      orgId: payload.organizationId,
    },
    organizationScope: null,
    selectedOrganizationId: payload.organizationId,
    organizationIds: [payload.organizationId],
  }
  await executeDealIntake({
    commandBus,
    ctx: commandCtx,
    commandInput: {
      organizationId: payload.organizationId,
      tenantId: payload.tenantId,
      businessName: mapped.businessName,
      requestedAmount: mapped.requestedAmount,
      avgMonthlyRevenue: mapped.avgMonthlyRevenue,
      timeInBusinessMonths: mapped.timeInBusinessMonths,
      position: mapped.position,
      industry: mapped.industry,
      state: mapped.state,
      ein: mapped.ein,
      legalAddress: mapped.legalAddress,
      startDate: mapped.startDate,
      ownerUserId: mapped.ownerUserId,
      ownerEmail: mapped.ownerEmail,
      ownerFirstName: mapped.ownerFirstName,
      ownerLastName: mapped.ownerLastName,
      ownerPhone: mapped.ownerPhone,
      leadSourceCode: mapped.leadSourceCode,
      statementUrls: mapped.statementUrls,
      statementAttachmentIds: mapped.statementAttachmentIds,
      applicationAttachmentIds: mapped.applicationAttachmentIds,
      assignmentMethod: mapped.ownerUserId ? 'form_rule' : 'round_robin',
      provider: mapped.provider,
    },
  })
}

export default handler
