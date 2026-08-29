import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand, type CommandBus, type CommandHandler } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { McaDeal, McaDocument, McaLeadSource } from '../data/entities'
import { intakeCommandSchema, type IntakeCommandInput } from '../data/validators'
import { emitMerchantAdvancesEvent } from '../events'
import { resolveIntakeAssignment } from '../lib/intake/assignment'
import { linkOptionalCustomers } from '../lib/intake/customers'
import { tryResolve } from '../lib/intake/tryResolve'
import { toNullableDecimal, toNullableText } from '../lib/crudScope'

const logger = createLogger('merchant_advances').child({ component: 'intake-command' })

export const MCA_DEAL_RESOURCE_KIND = 'merchant_advances.deal'
export const MCA_DEAL_ENTITY_ID = 'merchant_advances:mca_deal'

export type IntakeCommandResult = {
  dealId: string
  ownerUserId: string | null
  assignmentMethod: string
  merchantCompanyId: string | null
  primaryPersonId: string | null
  documentIds: string[]
  statementUrls: string[]
  pipelineStatus: string
}

const dealCrudEvents = {
  module: 'merchant_advances',
  entity: 'deal',
  persistent: true,
  buildPayload: (ctx: { identifiers: { id: string; organizationId: string | null; tenantId: string | null } }) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

const dealCrudIndexer = {
  entityType: MCA_DEAL_ENTITY_ID,
}

function parseInput(raw: unknown): IntakeCommandInput {
  const parsed = intakeCommandSchema.safeParse(raw)
  if (!parsed.success) {
    throw new CrudHttpError(400, { error: '[internal] MCA intake command input is invalid' })
  }
  return parsed.data
}

const intakeDealCommand: CommandHandler<IntakeCommandInput, IntakeCommandResult> = {
  id: 'merchant_advances.deal.intake',
  async execute(rawInput, ctx) {
    const input = parseInput(rawInput)
    ensureTenantScope(ctx, input.tenantId)
    ensureOrganizationScope(ctx, input.organizationId)
    const scope = { tenantId: input.tenantId, organizationId: input.organizationId }
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const commandBus = tryResolve<CommandBus>(ctx.container, 'commandBus')
    const customers = commandBus
      ? await linkOptionalCustomers({
        commandBus,
        ctx,
        scope,
        mapped: {
          businessName: input.businessName,
          requestedAmount: input.requestedAmount != null ? String(input.requestedAmount) : null,
          avgMonthlyRevenue: input.avgMonthlyRevenue != null ? String(input.avgMonthlyRevenue) : null,
          timeInBusinessMonths: input.timeInBusinessMonths ?? null,
          position: input.position ?? null,
          industry: input.industry ?? null,
          state: input.state ?? null,
          ein: input.ein ?? null,
          legalAddress: input.legalAddress ?? null,
          startDate: input.startDate ?? null,
          ownerEmail: input.ownerEmail ?? null,
          ownerFirstName: input.ownerFirstName ?? null,
          ownerLastName: input.ownerLastName ?? null,
          ownerPhone: input.ownerPhone ?? null,
          ownerUserId: input.ownerUserId ?? null,
          leadSourceCode: input.leadSourceCode ?? null,
          statementUrls: input.statementUrls ?? [],
          statementAttachmentIds: input.statementAttachmentIds ?? [],
          applicationAttachmentIds: input.applicationAttachmentIds ?? [],
          provider: input.provider ?? 'custom',
        },
      })
      : {
        merchantCompanyId: input.merchantCompanyId ?? null,
        merchantNameSnapshot: input.businessName,
        merchantStateSnapshot: input.state ?? null,
        primaryPersonId: input.primaryPersonId ?? null,
      }

    const assignment = await resolveIntakeAssignment({
      em,
      scope,
      mappedOwnerUserId: input.ownerUserId ?? null,
    })

    let leadSourceId = input.leadSourceId ?? null
    if (!leadSourceId && input.leadSourceCode) {
      const source = await em.findOne(McaLeadSource, {
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        code: input.leadSourceCode,
        deletedAt: null,
      })
      leadSourceId = source?.id ?? null
    }

    const statementIds = input.statementAttachmentIds ?? []
    const applicationIds = input.applicationAttachmentIds ?? []
    const pipelineStatus = statementIds.length > 0 ? 'statements_in' : (input.pipelineStatus ?? 'new_app')

    const deal = em.create(McaDeal, {
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      businessName: input.businessName,
      merchantCompanyId: customers.merchantCompanyId,
      merchantNameSnapshot: customers.merchantNameSnapshot,
      merchantStateSnapshot: customers.merchantStateSnapshot,
      primaryPersonId: customers.primaryPersonId,
      customerDealId: input.customerDealId ?? null,
      ownerUserId: assignment.ownerUserId,
      pipelineStatus,
      requestedAmount: toNullableDecimal(input.requestedAmount),
      avgMonthlyRevenue: toNullableDecimal(input.avgMonthlyRevenue),
      timeInBusinessMonths: input.timeInBusinessMonths ?? null,
      position: input.position ?? null,
      industry: toNullableText(input.industry),
      state: toNullableText(input.state),
      ein: toNullableText(input.ein),
      legalAddress: toNullableText(input.legalAddress),
      startDate: input.startDate ? new Date(input.startDate) : null,
      leadSourceId,
      leadBatchId: input.leadBatchId ?? null,
      assignmentMethod: assignment.assignmentMethod,
    })

    const documents: McaDocument[] = []
    await withAtomicFlush(em, [
      () => {
        em.persist(deal)
        if (assignment.settings && assignment.assignmentMethod === 'round_robin') {
          em.persist(assignment.settings)
        }
      },
    ], { transaction: true })

    for (const attachmentId of statementIds) {
      documents.push(em.create(McaDocument, {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        dealId: deal.id,
        classification: 'statement',
        attachmentId,
        isOriginal: true,
      }))
    }
    for (const attachmentId of applicationIds) {
      documents.push(em.create(McaDocument, {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        dealId: deal.id,
        classification: 'application',
        attachmentId,
        isOriginal: true,
      }))
    }
    if (documents.length) {
      await withAtomicFlush(em, [
        () => {
          for (const document of documents) em.persist(document)
        },
      ], { transaction: true })
    }

    const dataEngine = tryResolve<DataEngine>(ctx.container, 'dataEngine')
    if (dataEngine) {
      await emitCrudSideEffects({
        dataEngine,
        action: 'created',
        entity: deal,
        identifiers: {
          id: deal.id,
          organizationId: deal.organizationId,
          tenantId: deal.tenantId,
        },
        indexer: dealCrudIndexer,
        events: dealCrudEvents,
      })
    }

    try {
      await emitMerchantAdvancesEvent('merchant_advances.deal.created', {
        id: deal.id,
        organizationId: deal.organizationId,
        tenantId: deal.tenantId,
        businessName: deal.businessName,
      })
    } catch (err) {
      logger.warn('MCA deal created event emit skipped', { err })
    }

    return {
      dealId: deal.id,
      ownerUserId: deal.ownerUserId ?? null,
      assignmentMethod: deal.assignmentMethod,
      merchantCompanyId: deal.merchantCompanyId ?? null,
      primaryPersonId: deal.primaryPersonId ?? null,
      documentIds: documents.map((document) => document.id),
      statementUrls: input.statementUrls ?? [],
      pipelineStatus: deal.pipelineStatus,
    }
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('merchant_advances.audit.dealIntake', 'Create MCA deal from intake'),
      resourceKind: MCA_DEAL_RESOURCE_KIND,
      resourceId: result.dealId,
    }
  },
}

registerCommand(intakeDealCommand)
