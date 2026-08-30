import { SUNSET_DINER_FIXTURE } from './types'

export type SunsetDinerIntakePayload = {
  provider: 'custom'
  businessName: string
  industry: string
  state: string
  avgMonthlyRevenue: string
  timeInBusinessMonths: number
  position: number
  requestedAmount: string
}

export function buildSunsetDinerIntakePayload(): SunsetDinerIntakePayload {
  return {
    provider: 'custom',
    businessName: SUNSET_DINER_FIXTURE.businessName,
    industry: SUNSET_DINER_FIXTURE.industry,
    state: SUNSET_DINER_FIXTURE.state,
    avgMonthlyRevenue: SUNSET_DINER_FIXTURE.avgMonthlyRevenue,
    timeInBusinessMonths: SUNSET_DINER_FIXTURE.timeInBusinessMonths,
    position: SUNSET_DINER_FIXTURE.position,
    requestedAmount: SUNSET_DINER_FIXTURE.requestedAmount,
  }
}

export function intakeFixtureHasRemoteUrls(payload: Record<string, unknown>): boolean {
  const urls = payload.statementUrls
  return Array.isArray(urls) && urls.some((value) => typeof value === 'string' && value.startsWith('http'))
}

export function stripRemoteStatementUrls<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload }
  if ('statementUrls' in next) delete next.statementUrls
  return next
}

export const HARBOR_SAMPLE_REPLY = {
  from: 'uw@harboradvance.example',
  subject: 'Sunset Diner — approved',
  body: 'Harbor Advance: approved $75,000 at 1.32 for 6 months, daily $585. 10 points.',
  source: 'manual' as const,
  status: 'offered' as const,
  amount: '75000',
  factor: '1.32',
  termMonths: 6,
  paymentAmount: '585',
  paymentFrequency: 'daily' as const,
  commissionPoints: '10',
}

export function buildIntakeSamplePayload(input: {
  organizationId: string
  tenantId: string
}): Record<string, unknown> {
  return {
    provider: 'custom',
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    businessName: 'Sunset Diner',
    industry: 'Auto repair',
    state: 'TX',
    avgMonthlyRevenue: '142000',
    timeInBusinessMonths: 36,
    position: 1,
    requestedAmount: '75000',
    ownerEmail: 'owner@sunsetdiner.example',
    ownerFirstName: 'Sam',
    ownerLastName: 'Rivera',
  }
}
