import { matchInboundReply, type ReplyMatchCandidate } from '../matchDeal'
import { verifyInboundSignature } from '../signature'
import { signWebhookPayload } from '../../submit/router'

const DEAL_ID = '018f1a2b-3c4d-4000-8000-000000000001'
const SUB_ID = '018f1a2b-3c4d-4000-8000-000000000002'
const FUNDER_ID = '018f1a2b-3c4d-4000-8000-000000000003'

const harbor: ReplyMatchCandidate = {
  dealId: DEAL_ID,
  submissionId: SUB_ID,
  funderId: FUNDER_ID,
  businessName: 'Sunset Diner',
  funderName: 'Harbor Advance',
  funderCode: 'harbor',
  submitEmail: null,
  funderReference: 'HA-1001',
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
}

describe('merchant_advances matchInboundReply', () => {
  it('matches merchant name plus funder name in a recent window', () => {
    const match = matchInboundReply({
      subject: 'Sunset Diner approved',
      body: 'Approved by Harbor Advance',
      from: 'uw@harboradvance.example',
      now: new Date('2026-08-10T00:00:00.000Z'),
    }, [harbor])
    expect(match).toEqual({ dealId: DEAL_ID, submissionId: SUB_ID, funderId: FUNDER_ID })
  })

  it('matches an explicit funder reference', () => {
    const match = matchInboundReply({
      funderReference: 'HA-1001',
      now: new Date('2026-08-10T00:00:00.000Z'),
    }, [harbor])
    expect(match?.submissionId).toBe(SUB_ID)
  })

  it('ignores stale submissions', () => {
    const match = matchInboundReply({
      subject: 'Sunset Diner approved',
      now: new Date('2027-01-01T00:00:00.000Z'),
    }, [harbor])
    expect(match).toBeNull()
  })
})

describe('merchant_advances inbound signature', () => {
  it('accepts a fresh HMAC and rejects a stale one', () => {
    const body = '{"ok":true}'
    const fresh = signWebhookPayload(body, 'secret', 1_000)
    expect(verifyInboundSignature(body, fresh, 'secret', 1_010)).toBe(true)
    expect(verifyInboundSignature(body, fresh, 'secret', 1_000 + 400)).toBe(false)
    expect(verifyInboundSignature(body, fresh, 'wrong', 1_010)).toBe(false)
  })
})
