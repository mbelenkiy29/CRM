import { createHmac } from 'node:crypto'
import { extractIntakeEventType, extractIntakeMessageId, verifySharedIntakeSecret } from '../sourceVerifier'

describe('merchant_advances intake source verifier', () => {
  it('accepts a matching shared secret header', async () => {
    await expect(verifySharedIntakeSecret(
      { body: '{}', headers: { 'x-mca-intake-secret': 'super-secret' }, parsedBody: {} },
      { secret: 'super-secret' },
    )).resolves.toBe(true)
  })

  it('rejects a mismatched secret', async () => {
    await expect(verifySharedIntakeSecret(
      { body: '{}', headers: { 'x-mca-intake-secret': 'wrong' }, parsedBody: {} },
      { secret: 'super-secret' },
    )).resolves.toBe(false)
  })

  it('accepts a JotForm HMAC signature', async () => {
    const body = '{"formID":"1"}'
    const digest = createHmac('sha256', 'jot-secret').update(body).digest('hex')
    await expect(verifySharedIntakeSecret(
      { body, headers: { 'jotform-signature': digest }, parsedBody: { formID: '1' } },
      { secret: 'jot-secret' },
    )).resolves.toBe(true)
  })

  it('extracts event type and message id', () => {
    expect(extractIntakeEventType({ type: 'ContactCreate' }, {})).toBe('ContactCreate')
    expect(extractIntakeEventType({}, {})).toBe('mca.application.submitted')
    expect(extractIntakeMessageId({ submissionID: 'sub-1' }, {})).toBe('sub-1')
  })
})
