import { fundingCreateSchema, renewalUpdateSchema, replyCreateSchema, replyInboundSchema, submitSendSchema } from '../validators'

const OFFER_ID = '018f1a2b-3c4d-4000-8000-000000000001'
const DEAL_ID = '018f1a2b-3c4d-4000-8000-000000000002'

describe('merchant_advances workspace validators', () => {
  it('accepts a funding create payload with offer id', () => {
    const parsed = fundingCreateSchema.parse({ offerId: OFFER_ID })
    expect(parsed.offerId).toBe(OFFER_ID)
  })

  it('accepts renewal write-back statuses', () => {
    for (const status of ['contacted', 'renewed', 'lost'] as const) {
      expect(renewalUpdateSchema.parse({
        id: DEAL_ID,
        status,
      }).status).toBe(status)
    }
  })

  it('rejects an unknown renewal status', () => {
    expect(() => renewalUpdateSchema.parse({
      id: DEAL_ID,
      status: 'funded',
    })).toThrow()
  })

  it('requires at least one funder id on submit', () => {
    expect(() => submitSendSchema.parse({
      dealId: DEAL_ID,
      funderIds: [],
    })).toThrow()
    expect(submitSendSchema.parse({
      dealId: DEAL_ID,
      funderIds: [OFFER_ID],
    }).funderIds).toEqual([OFFER_ID])
  })

  it('accepts a pasted manual reply', () => {
    const parsed = replyCreateSchema.parse({
      dealId: DEAL_ID,
      rawSource: 'manual',
      classification: 'other',
      rawBody: 'Harbor Advance: need voided check',
    })
    expect(parsed.rawSource).toBe('manual')
  })

  it('accepts an inbound funder email payload', () => {
    const parsed = replyInboundSchema.parse({
      from: 'uw@harboradvance.example',
      subject: 'Sunset Diner approved',
      body: 'Approved. $75,000 at 1.32 for 6 months, daily $585. 10 points.',
    })
    expect(parsed.from).toContain('harbor')
  })
})

