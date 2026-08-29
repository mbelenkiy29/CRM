import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { IntakeMappedDeal } from './formMapper'

const logger = createLogger('merchant_advances').child({ component: 'intake-customers' })

export type LinkedCustomerSnapshots = {
  merchantCompanyId: string | null
  merchantNameSnapshot: string
  merchantStateSnapshot: string | null
  primaryPersonId: string | null
}

type CompanyCreateResult = { entityId?: string; companyId?: string }
type PersonCreateResult = { entityId?: string; personId?: string }

export async function linkOptionalCustomers(input: {
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  scope: { tenantId: string; organizationId: string }
  mapped: IntakeMappedDeal
}): Promise<LinkedCustomerSnapshots> {
  const snapshots: LinkedCustomerSnapshots = {
    merchantCompanyId: null,
    merchantNameSnapshot: input.mapped.businessName,
    merchantStateSnapshot: input.mapped.state,
    primaryPersonId: null,
  }
  try {
    const company = await input.commandBus.execute<
      Record<string, unknown>,
      CompanyCreateResult
    >('customers.companies.create', {
      input: {
        organizationId: input.scope.organizationId,
        tenantId: input.scope.tenantId,
        displayName: input.mapped.businessName,
        legalName: input.mapped.businessName,
        industry: input.mapped.industry ?? undefined,
        source: `mca_intake:${input.mapped.provider}`,
        primaryEmail: input.mapped.ownerEmail ?? undefined,
        primaryPhone: input.mapped.ownerPhone ?? undefined,
      },
      ctx: input.ctx,
    })
    snapshots.merchantCompanyId = company.result.entityId ?? company.result.companyId ?? null
  } catch (err) {
    logger.warn('Optional customers company create skipped', { err })
    return snapshots
  }

  if (!input.mapped.ownerFirstName || !input.mapped.ownerLastName) return snapshots
  try {
    const person = await input.commandBus.execute<
      Record<string, unknown>,
      PersonCreateResult
    >('customers.people.create', {
      input: {
        organizationId: input.scope.organizationId,
        tenantId: input.scope.tenantId,
        firstName: input.mapped.ownerFirstName,
        lastName: input.mapped.ownerLastName,
        displayName: [input.mapped.ownerFirstName, input.mapped.ownerLastName].join(' '),
        primaryEmail: input.mapped.ownerEmail ?? undefined,
        primaryPhone: input.mapped.ownerPhone ?? undefined,
        companyEntityId: snapshots.merchantCompanyId,
        source: `mca_intake:${input.mapped.provider}`,
      },
      ctx: input.ctx,
    })
    snapshots.primaryPersonId = person.result.entityId ?? person.result.personId ?? null
  } catch (err) {
    logger.warn('Optional customers person create skipped', { err })
  }
  return snapshots
}
