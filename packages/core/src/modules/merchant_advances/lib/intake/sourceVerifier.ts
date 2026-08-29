import { createHmac, timingSafeEqual } from 'node:crypto'
import type { InboundWebhookRequest } from '@open-mercato/shared/lib/webhooks'

function headerValue(headers: Record<string, string>, name: string): string | null {
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return match ? match[1] : null
}

function digestEquals(expected: string, provided: string): boolean {
  const left = Buffer.from(expected)
  const right = Buffer.from(provided)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export async function verifySharedIntakeSecret(
  request: InboundWebhookRequest,
  credentials: Record<string, string>,
): Promise<boolean> {
  const secret = credentials.secret ?? credentials.webhookSecret ?? ''
  if (!secret) return false
  const provided =
    headerValue(request.headers, 'x-mca-intake-secret')
    ?? headerValue(request.headers, 'x-webhook-secret')
    ?? headerValue(request.headers, 'x-ghl-signature')
    ?? headerValue(request.headers, 'x-zoho-webhook-signature')
  if (provided && digestEquals(secret, provided)) return true

  const jotformSig = headerValue(request.headers, 'jotform-signature') ?? headerValue(request.headers, 'x-jotform-signature')
  if (jotformSig) {
    const digest = createHmac('sha256', secret).update(request.body).digest('hex')
    return digestEquals(digest, jotformSig)
  }
  return false
}

export function extractIntakeEventType(
  body: Record<string, unknown>,
  _headers: Record<string, string>,
): string {
  if (typeof body.eventType === 'string' && body.eventType.trim()) return body.eventType
  if (typeof body.type === 'string' && body.type.trim()) return body.type
  return 'mca.application.submitted'
}

export function extractIntakeMessageId(
  body: Record<string, unknown>,
  headers: Record<string, string>,
): string | undefined {
  const fromHeader = headerValue(headers, 'x-webhook-message-id') ?? headerValue(headers, 'x-request-id')
  if (fromHeader) return fromHeader
  if (typeof body.submissionID === 'string') return body.submissionID
  if (typeof body.submissionId === 'string') return body.submissionId
  if (typeof body.id === 'string') return body.id
  return undefined
}
