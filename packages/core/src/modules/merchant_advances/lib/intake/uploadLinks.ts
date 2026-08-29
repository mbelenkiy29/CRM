import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { signAudienceJwt, verifyAudienceJwt, type JwtPayload } from '@open-mercato/shared/lib/auth/jwt'
import { MCA_DOCUMENT_CLASSIFICATIONS, type McaDocumentClassification } from '../../data/constants'
import { isDocumentClassification } from './formMapper'

export const MCA_UPLOAD_TOKEN_AUDIENCE = 'mca-intake-upload'
export const MCA_DEFAULT_UPLOAD_TTL_HOURS = 72
export const MCA_UPLOAD_TOKEN_CACHE_PREFIX = 'mca:intake-upload'

export type IntakeUploadTokenClaims = {
  dealId: string
  tenantId: string
  organizationId: string
  classification: McaDocumentClassification
  jti: string
  exp: number
}

export type IssuedUploadToken = {
  token: string
  tokenHash: string
  expiresAt: Date
  claims: IntakeUploadTokenClaims
}

export type UploadTokenCache = {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown, options?: { ttl?: number }) => Promise<unknown>
  delete?: (key: string) => Promise<unknown>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function hashUploadToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function uploadTokenCacheKey(tenantId: string, tokenHash: string): string {
  return `${MCA_UPLOAD_TOKEN_CACHE_PREFIX}:${tenantId}:${tokenHash}`
}

export function resolveUploadTtlHours(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return MCA_DEFAULT_UPLOAD_TTL_HOURS
  const hours = Math.round(numeric)
  if (hours < 1) return 1
  if (hours > 24 * 30) return 24 * 30
  return hours
}

export function issueUploadToken(input: {
  dealId: string
  tenantId: string
  organizationId: string
  classification?: McaDocumentClassification
  ttlHours?: number
  now?: Date
}): IssuedUploadToken {
  if (!UUID_RE.test(input.dealId) || !UUID_RE.test(input.tenantId) || !UUID_RE.test(input.organizationId)) {
    throw new Error('[internal] MCA upload token scope is invalid')
  }
  const classification = input.classification && isDocumentClassification(input.classification)
    ? input.classification
    : 'statement'
  const ttlHours = resolveUploadTtlHours(input.ttlHours)
  const now = input.now ?? new Date()
  const jti = randomUUID()
  const expiresInSec = ttlHours * 60 * 60
  const token = signAudienceJwt(
    MCA_UPLOAD_TOKEN_AUDIENCE,
    {
      sub: input.dealId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      classification,
      jti,
    },
    expiresInSec,
  )
  return {
    token,
    tokenHash: hashUploadToken(token),
    expiresAt: new Date(now.getTime() + expiresInSec * 1000),
    claims: {
      dealId: input.dealId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      classification,
      jti,
      exp: Math.floor(now.getTime() / 1000) + expiresInSec,
    },
  }
}

export function readUploadTokenClaims(token: string): IntakeUploadTokenClaims | null {
  const payload = verifyAudienceJwt(MCA_UPLOAD_TOKEN_AUDIENCE, token)
  if (!payload) return null
  return parseUploadTokenPayload(payload)
}

function parseUploadTokenPayload(payload: JwtPayload): IntakeUploadTokenClaims | null {
  const dealId = typeof payload.sub === 'string' ? payload.sub : null
  const tenantId = typeof payload.tenantId === 'string' ? payload.tenantId : null
  const organizationId = typeof payload.organizationId === 'string' ? payload.organizationId : null
  const classification = typeof payload.classification === 'string' ? payload.classification : null
  const jti = typeof payload.jti === 'string' ? payload.jti : null
  const exp = typeof payload.exp === 'number' ? payload.exp : null
  if (!dealId || !tenantId || !organizationId || !jti || !exp) return null
  if (!UUID_RE.test(dealId) || !UUID_RE.test(tenantId) || !UUID_RE.test(organizationId)) return null
  if (!classification || !isDocumentClassification(classification)) return null
  return { dealId, tenantId, organizationId, classification, jti, exp }
}

export async function persistUploadTokenHash(
  cache: UploadTokenCache | null | undefined,
  issued: IssuedUploadToken,
): Promise<void> {
  if (!cache) return
  const ttlMs = Math.max(issued.expiresAt.getTime() - Date.now(), 1000)
  await cache.set(
    uploadTokenCacheKey(issued.claims.tenantId, issued.tokenHash),
    { jti: issued.claims.jti, dealId: issued.claims.dealId },
    { ttl: ttlMs },
  )
}

export async function consumeUploadToken(
  cache: UploadTokenCache | null | undefined,
  token: string,
): Promise<IntakeUploadTokenClaims | null> {
  const claims = readUploadTokenClaims(token)
  if (!claims) return null
  const tokenHash = hashUploadToken(token)
  if (!cache) return claims
  const key = uploadTokenCacheKey(claims.tenantId, tokenHash)
  const stored = await cache.get(key)
  if (!stored) return null
  if (cache.delete) await cache.delete(key)
  return claims
}

export function secretsMatch(expected: string, provided: string): boolean {
  const left = Buffer.from(expected)
  const right = Buffer.from(provided)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export { MCA_DOCUMENT_CLASSIFICATIONS }
