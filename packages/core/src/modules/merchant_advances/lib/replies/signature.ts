import { timingSafeEqual } from 'crypto'
import { signWebhookPayload } from '../submit/router'

export const INBOUND_SIGNATURE_MAX_AGE_SECONDS = 300

export function verifyInboundSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false
  const parts = Object.fromEntries(
    header.split(',').map((piece) => {
      const [key, ...rest] = piece.split('=')
      return [key?.trim() ?? '', rest.join('=').trim()]
    }),
  )
  const timestamp = Number(parts.t)
  const digest = parts.v1
  if (!Number.isFinite(timestamp) || !digest) return false
  if (Math.abs(nowSeconds - timestamp) > INBOUND_SIGNATURE_MAX_AGE_SECONDS) return false
  const expected = signWebhookPayload(rawBody, secret, timestamp)
  const expectedDigest = expected.split('v1=')[1] ?? ''
  const left = Buffer.from(digest)
  const right = Buffer.from(expectedDigest)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function inboundReplySecret(): string | null {
  const value = process.env.MCA_REPLIES_INBOUND_SECRET
  return value && value.trim() ? value.trim() : null
}
