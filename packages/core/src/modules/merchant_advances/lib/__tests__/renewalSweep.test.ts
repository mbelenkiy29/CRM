import { McaDeal, McaFunding, McaRenewal, McaWorkspaceSettings } from '../../data/entities'
import {
  applyRenewalSweep,
  listPastApprovalDeals,
  remainingTermDays,
  runRenewalSweep,
  shouldSurfaceRenewal,
} from '../renewalSweep'

const SCOPE = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
}

const OTHER_SCOPE = {
  tenantId: '33333333-3333-4333-8333-333333333333',
  organizationId: '44444444-4444-4444-8444-444444444444',
}

function funding(overrides: Partial<Parameters<typeof applyRenewalSweep>[0]['fundings'][number]> = {}) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tenantId: SCOPE.tenantId,
    organizationId: SCOPE.organizationId,
    dealId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    merchantCompanyId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    fundedAt: new Date('2026-01-01T00:00:00.000Z'),
    termMonths: 6,
    paymentFrequency: 'daily',
    paidInPct: null,
    ...overrides,
  }
}

describe('merchant_advances renewal sweep helper', () => {
  const now = new Date('2026-04-16T00:00:00.000Z')

  it('creates a due renewal when a past funding is ~83% paid in', () => {
    const result = applyRenewalSweep({
      fundings: [funding()],
      renewals: [],
    }, { scope: SCOPE, now, nextId: () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })

    expect(result.fundings[0]?.paidInPct).toBe('83.33')
    expect(result.created).toHaveLength(1)
    expect(remainingTermDays({
      fundedAt: new Date('2026-01-01T00:00:00.000Z'),
      frequency: 'daily',
      termMonths: 6,
      now,
    })).toBe(21)
    expect(result.created[0]).toMatchObject({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      fundingId: funding().id,
      dealId: funding().dealId,
      merchantCompanyId: funding().merchantCompanyId,
      paidInPct: '83.33',
      status: 'due',
    })
    expect(result.surfaced).toHaveLength(1)
    expect(result.renewals).toHaveLength(1)
  })

  it('surfaces when remaining term is 30 days or less even below the paid-in threshold', () => {
    const fundedAt = new Date('2026-01-01T00:00:00.000Z')
    const soon = new Date('2026-04-07T00:00:00.000Z')
    const remaining = remainingTermDays({ fundedAt, frequency: 'daily', termMonths: 6, now: soon })
    expect(remaining).toBe(30)
    expect(shouldSurfaceRenewal(76.19, remaining)).toBe(true)

    const result = applyRenewalSweep({
      fundings: [funding({ fundedAt })],
      renewals: [],
    }, { scope: SCOPE, now: soon, nextId: () => 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' })

    expect(Number(result.fundings[0]?.paidInPct)).toBeLessThan(80)
    expect(result.created[0]?.status).toBe('due')
  })

  it('does not create a renewal while paid-in is below threshold and term remains over 30 days', () => {
    const result = applyRenewalSweep({
      fundings: [funding({ fundedAt: new Date('2026-04-01T00:00:00.000Z') })],
      renewals: [],
    }, { scope: SCOPE, now, nextId: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff' })

    expect(Number(result.fundings[0]?.paidInPct)).toBeLessThan(80)
    expect(result.created).toHaveLength(0)
    expect(result.renewals).toHaveLength(0)
  })

  it('upserts an existing watching row to due without duplicating', () => {
    const existing = {
      id: '99999999-9999-4999-8999-999999999999',
      tenantId: SCOPE.tenantId,
      organizationId: SCOPE.organizationId,
      fundingId: funding().id,
      dealId: funding().dealId,
      merchantCompanyId: funding().merchantCompanyId,
      paidInPct: '10.00',
      surfacedAt: null,
      status: 'watching' as const,
    }
    const first = applyRenewalSweep({
      fundings: [funding()],
      renewals: [existing],
    }, { scope: SCOPE, now })
    expect(first.created).toHaveLength(0)
    expect(first.updated).toHaveLength(1)
    expect(first.renewals).toHaveLength(1)
    expect(first.renewals[0]?.status).toBe('due')
    expect(first.surfaced).toHaveLength(1)

    const second = applyRenewalSweep({
      fundings: [funding({ paidInPct: '83.33' })],
      renewals: first.renewals,
    }, { scope: SCOPE, now })
    expect(second.created).toHaveLength(0)
    expect(second.renewals).toHaveLength(1)
    expect(second.surfaced).toHaveLength(0)
    expect(second.renewals[0]?.id).toBe(existing.id)
  })

  it('updates paid-in on contacted renewals without changing status', () => {
    const result = applyRenewalSweep({
      fundings: [funding()],
      renewals: [{
        id: '12121212-1212-4121-8121-121212121212',
        tenantId: SCOPE.tenantId,
        organizationId: SCOPE.organizationId,
        fundingId: funding().id,
        dealId: funding().dealId,
        paidInPct: '80.00',
        surfacedAt: new Date('2026-04-01T00:00:00.000Z'),
        status: 'contacted',
      }],
    }, { scope: SCOPE, now })

    expect(result.renewals[0]?.status).toBe('contacted')
    expect(result.renewals[0]?.paidInPct).toBe('83.33')
    expect(result.surfaced).toHaveLength(0)
  })

  it('ignores fundings from another tenant or organization', () => {
    const result = applyRenewalSweep({
      fundings: [funding({
        id: 'abababab-abab-4bab-8bab-abababababab',
        tenantId: OTHER_SCOPE.tenantId,
        organizationId: OTHER_SCOPE.organizationId,
      })],
      renewals: [],
    }, { scope: SCOPE, now, nextId: () => 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd' })

    expect(result.skippedOtherScope).toBe(1)
    expect(result.created).toHaveLength(0)
    expect(result.renewals).toHaveLength(0)
    expect(result.fundings[0]?.paidInPct).toBeNull()
  })

  it('lists past-approval merchants that are funded and have no open deal', () => {
    const funded = {
      id: 'deal-funded',
      tenantId: SCOPE.tenantId,
      organizationId: SCOPE.organizationId,
      merchantCompanyId: 'merchant-1',
      pipelineStatus: 'funded' as const,
      businessName: 'Alpha LLC',
      merchantNameSnapshot: 'Alpha LLC',
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    }
    const openSameMerchant = {
      ...funded,
      id: 'deal-open',
      pipelineStatus: 'underwriting' as const,
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    }
    const pastOnly = {
      ...funded,
      id: 'deal-past',
      merchantCompanyId: 'merchant-2',
      businessName: 'Beta LLC',
      merchantNameSnapshot: 'Beta LLC',
    }
    const otherTenant = {
      ...pastOnly,
      id: 'deal-other',
      tenantId: OTHER_SCOPE.tenantId,
      organizationId: OTHER_SCOPE.organizationId,
      merchantCompanyId: 'merchant-3',
    }

    expect(listPastApprovalDeals([funded, pastOnly, otherTenant], SCOPE).map((deal) => deal.id)).toEqual([
      'deal-funded',
      'deal-past',
    ])
    expect(listPastApprovalDeals([funded, openSameMerchant, pastOnly], SCOPE).map((deal) => deal.id)).toEqual([
      'deal-past',
    ])
  })

  it('runRenewalSweep upserts a scoped renewal row from a past funding', async () => {
    const fundedAt = new Date('2026-01-01T00:00:00.000Z')
    const fundingRow = {
      id: funding().id,
      tenantId: SCOPE.tenantId,
      organizationId: SCOPE.organizationId,
      dealId: funding().dealId,
      fundedAt,
      termMonths: 6,
      paymentFrequency: 'daily',
      paidInPct: null,
    }
    const dealRow = {
      id: funding().dealId,
      merchantCompanyId: funding().merchantCompanyId,
    }
    const persisted: Array<Record<string, unknown>> = []
    const emit = jest.fn(async () => undefined)
    const em = {
      findOne: jest.fn(async (entity: unknown) => (
        entity === McaWorkspaceSettings ? { renewalPaidInThreshold: 80 } : null
      )),
      find: jest.fn(async (entity: unknown) => {
        if (entity === McaFunding) return [fundingRow]
        if (entity === McaDeal) return [dealRow]
        if (entity === McaRenewal) return []
        return []
      }),
      create: jest.fn((_entity: unknown, data: Record<string, unknown>) => data),
      persist: jest.fn((entity: Record<string, unknown>) => {
        persisted.push(entity)
        return em
      }),
      flush: jest.fn(async () => undefined),
    }

    const result = await runRenewalSweep(em as never, SCOPE, { now, emit })

    expect(fundingRow.paidInPct).toBe('83.33')
    expect(result.created).toHaveLength(1)
    expect(persisted).toHaveLength(1)
    expect(persisted[0]).toMatchObject({
      tenantId: SCOPE.tenantId,
      organizationId: SCOPE.organizationId,
      fundingId: funding().id,
      dealId: funding().dealId,
      merchantCompanyId: funding().merchantCompanyId,
      paidInPct: '83.33',
      status: 'due',
    })
    expect(emit).toHaveBeenCalledWith(
      'merchant_advances.renewal.surfaced',
      expect.objectContaining({
        fundingId: funding().id,
        tenantId: SCOPE.tenantId,
        organizationId: SCOPE.organizationId,
      }),
      expect.objectContaining({ tenantId: SCOPE.tenantId, organizationId: SCOPE.organizationId }),
    )
  })
})
