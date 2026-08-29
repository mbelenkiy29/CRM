import { classifyReply, hasOfferTerms } from '../classifyReply'

const SAMPLE = "Approved. $75,000 at 1.32 for 6 months, daily $585. 10 points… Need 4 months bank statements and driver's license"

describe('merchant_advances classifyReply', () => {
  it('extracts the MCA Pilot sample offer and stips', () => {
    const parsed = classifyReply(SAMPLE)
    expect(parsed.classification).toBe('offer')
    expect(parsed.amount).toBe('75000.00')
    expect(parsed.factor).toBe('1.32')
    expect(parsed.termMonths).toBe(6)
    expect(parsed.paymentAmount).toBe('585.00')
    expect(parsed.paymentFrequency).toBe('daily')
    expect(parsed.commissionPoints).toBe('10')
    expect(parsed.stips.some((stip) => /bank statements/i.test(stip))).toBe(true)
    expect(parsed.stips.some((stip) => /driver'?s license/i.test(stip))).toBe(true)
    expect(hasOfferTerms(parsed)).toBe(true)
  })

  it('classifies a decline without inventing terms', () => {
    const parsed = classifyReply('Unfortunately we cannot approve Sunset Diner at this time.')
    expect(parsed.classification).toBe('decline')
    expect(parsed.amount).toBeNull()
    expect(hasOfferTerms(parsed)).toBe(false)
  })

  it('classifies a bare stip request', () => {
    const parsed = classifyReply('Please provide a voided check and the owner driver license.')
    expect(parsed.classification).toBe('stip_request')
    expect(hasOfferTerms(parsed)).toBe(false)
  })

  it('leaves unknown bodies on the replies tab as other', () => {
    const parsed = classifyReply('Checking in on this file.')
    expect(parsed.classification).toBe('other')
  })
})
