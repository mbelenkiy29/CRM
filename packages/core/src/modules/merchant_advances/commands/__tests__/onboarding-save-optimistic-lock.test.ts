import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

const enforceWithGuardsMock = jest.fn<Promise<void>, [unknown, Record<string, unknown>]>()

jest.mock('@open-mercato/shared/lib/crud/optimistic-lock-command', () => ({
  enforceCommandOptimisticLockWithGuards: (container: unknown, input: Record<string, unknown>) =>
    enforceWithGuardsMock(container, input),
}))

jest.mock('../../events', () => ({
  emitMerchantAdvancesEvent: jest.fn(async () => undefined),
}))

jest.mock('../settings', () => ({
  ...jest.requireActual('../settings'),
  loadIntakeWebhookSecret: jest.fn(async () => null),
  loadIntakeWorkspaceConfig: jest.fn(async () => ({ uploadLinksEnabled: false, uploadLinkTtlHours: 72 })),
}))

import { saveOnboardingCommand } from '../onboarding'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const ORG_ID = '22222222-2222-4222-8222-222222222222'
const SETTINGS_ID = '33333333-3333-4333-8333-333333333333'
const UPDATED_AT = new Date('2026-08-30T12:00:00.000Z')

type LoadedSettings = Record<string, unknown> | null

function makeEm(loaded: LoadedSettings) {
  return {
    fork() {
      return {
        findOne: jest.fn(async () => loaded),
        count: jest.fn(async () => 0),
        flush: jest.fn(async () => undefined),
        persist: jest.fn(),
        create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({
          id: SETTINGS_ID,
          onboarding: {},
          plan: 'supercharged',
          trialEndsAt: null,
          updatedAt: UPDATED_AT,
          ...data,
        })),
      }
    },
  }
}

function makeCtx(loaded: LoadedSettings, request?: Request | null): CommandRuntimeContext {
  const em = makeEm(loaded)
  return {
    container: { resolve: (key: string) => (key === 'em' ? em : undefined) },
    auth: { tenantId: TENANT_ID, orgId: ORG_ID, isSuperAdmin: true, sub: 'user-1' },
    organizationScope: null,
    selectedOrganizationId: ORG_ID,
    organizationIds: [ORG_ID],
    request: request ?? null,
  } as unknown as CommandRuntimeContext
}

beforeEach(() => {
  enforceWithGuardsMock.mockReset()
  enforceWithGuardsMock.mockResolvedValue(undefined)
})

describe('merchant_advances.onboarding.save — optimistic lock', () => {
  test('enforces the lock for an existing workspace settings row', async () => {
    const settings = {
      id: SETTINGS_ID,
      tenantId: TENANT_ID,
      organizationId: ORG_ID,
      onboarding: {},
      plan: 'supercharged',
      trialEndsAt: null,
      updatedAt: UPDATED_AT,
    }
    const ctx = makeCtx(settings, new Request('http://localhost/api/merchant_advances/onboarding', { method: 'PUT' }))

    await saveOnboardingCommand.execute({
      tenantId: TENANT_ID,
      organizationId: ORG_ID,
      gettingStarted: { currentStep: 1 },
    }, ctx)

    expect(enforceWithGuardsMock).toHaveBeenCalledTimes(1)
    const [container, input] = enforceWithGuardsMock.mock.calls[0]
    expect(container).toBe(ctx.container)
    expect(input).toMatchObject({
      resourceKind: 'merchant_advances.onboarding',
      resourceId: SETTINGS_ID,
      current: UPDATED_AT,
      request: ctx.request,
    })
  })

  test('skips enforcement and proceeds when no settings row exists yet', async () => {
    const ctx = makeCtx(null)

    await expect(saveOnboardingCommand.execute({
      tenantId: TENANT_ID,
      organizationId: ORG_ID,
      gettingStarted: { currentStep: 0 },
    }, ctx)).resolves.toMatchObject({ updatedAt: UPDATED_AT.toISOString() })

    expect(enforceWithGuardsMock).not.toHaveBeenCalled()
  })
})
