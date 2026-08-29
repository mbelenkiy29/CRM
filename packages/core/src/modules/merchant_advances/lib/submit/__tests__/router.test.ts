import { routeSubmission, signWebhookPayload } from '../router'

const base = {
  dealId: '018f1a2b-3c4d-4000-8000-000000000001',
  funderId: '018f1a2b-3c4d-4000-8000-000000000002',
  funderName: 'Harbor Advance',
  fromAddress: 'iso@example.com',
  submitEmail: 'submissions@example.com',
  portalUrl: 'https://example.com/portal',
  webhookUrl: 'https://example.com/hook',
  application: { businessName: 'Sunset Diner' },
  documents: [{ id: 'd1', classification: 'statement', attachmentId: 'a1', stamped: true }],
}

describe('merchant_advances submit router', () => {
  it('never pretends an API adapter posted', () => {
    const result = routeSubmission({ ...base, method: 'api' })
    expect(result.status).toBe('error')
    expect(result.validationErrors?.code).toBe('api_deferred')
  })

  it('creates a portal task payload instead of posting', () => {
    const result = routeSubmission({ ...base, method: 'portal' })
    expect(result.status).toBe('draft')
    expect(result.payloadSnapshot.task).toBe('complete funder portal')
  })

  it('queues email when outbound mail is not configured', () => {
    const result = routeSubmission({ ...base, method: 'email' }, { mailConfigured: false })
    expect(result.status).toBe('queued')
    expect(result.payloadSnapshot.queuedEmail).toBe(true)
  })

  it('signs a webhook payload', () => {
    const signature = signWebhookPayload('{"ok":true}', 'secret', 1)
    expect(signature).toMatch(/^t=1,v1=[0-9a-f]+$/)
    const result = routeSubmission({ ...base, method: 'webhook' })
    expect(result.status).toBe('sent')
    expect(result.payloadSnapshot.signature).toEqual(expect.stringMatching(/^t=\d+,v1=/))
  })

  it('keeps a missing email error on that funder only', () => {
    const result = routeSubmission({ ...base, method: 'email', submitEmail: null }, { mailConfigured: true })
    expect(result.status).toBe('error')
    expect(result.validationErrors?.code).toBe('submit_email_missing')
  })
})
