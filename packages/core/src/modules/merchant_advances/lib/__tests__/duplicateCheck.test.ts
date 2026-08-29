import { assertUniqueSubmission, findDuplicateSubmission } from '../duplicateCheck'

describe('merchant_advances duplicate check', () => {
  const dealId = '11111111-1111-1111-1111-111111111111'
  const funderId = '22222222-2222-2222-2222-222222222222'

  it('blocks a second open submission to the same funder', () => {
    const existing = [{ dealId, funderId, status: 'sent' }]
    expect(findDuplicateSubmission(existing, dealId, funderId)).toEqual(existing[0])
    expect(() => assertUniqueSubmission(existing, dealId, funderId)).toThrow(/duplicate submission/)
  })

  it('allows a different funder', () => {
    const existing = [{ dealId, funderId, status: 'sent' }]
    expect(findDuplicateSubmission(existing, dealId, '33333333-3333-3333-3333-333333333333')).toBeNull()
    expect(() => assertUniqueSubmission(existing, dealId, '33333333-3333-3333-3333-333333333333')).not.toThrow()
  })

  it('blocks the same merchant identity to the same funder on another deal', () => {
    const existing = [{
      dealId: '44444444-4444-4444-4444-444444444444',
      funderId,
      status: 'queued',
      merchantKey: 'ein:123456789',
    }]
    expect(findDuplicateSubmission(existing, dealId, funderId, 'ein:123456789')).toEqual(existing[0])
  })
})

