import { createHash } from 'node:crypto'

const DEAL_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const ORG_ID = '22222222-2222-4222-8222-222222222222'

jest.mock('@open-mercato/shared/lib/auth/jwt', () => {
  const tokens = new Map<string, Record<string, unknown>>()
  return {
    signAudienceJwt: (audience: string, payload: Record<string, unknown>, expiresInSec: number) => {
      const token = `tok.${Buffer.from(JSON.stringify({ ...payload, aud: audience, exp: Math.floor(Date.now() / 1000) + expiresInSec })).toString('base64url')}`
      tokens.set(token, { ...payload, aud: audience, exp: Math.floor(Date.now() / 1000) + expiresInSec })
      return token
    },
    verifyAudienceJwt: (audience: string, token: string) => {
      const payload = tokens.get(token)
      if (!payload || payload.aud !== audience) return null
      return payload
    },
  }
})

import {
  consumeUploadToken,
  hashUploadToken,
  issueUploadToken,
  persistUploadTokenHash,
  readUploadTokenClaims,
  resolveUploadTtlHours,
  secretsMatch,
} from '../uploadLinks'

describe('merchant_advances upload links', () => {
  it('issues a tenant-scoped hashed token', () => {
    const issued = issueUploadToken({
      dealId: DEAL_ID,
      tenantId: TENANT_ID,
      organizationId: ORG_ID,
      classification: 'statement',
      ttlHours: 2,
    })
    expect(issued.tokenHash).toBe(createHash('sha256').update(issued.token).digest('hex'))
    expect(issued.tokenHash).toBe(hashUploadToken(issued.token))
    expect(readUploadTokenClaims(issued.token)).toMatchObject({
      dealId: DEAL_ID,
      tenantId: TENANT_ID,
      organizationId: ORG_ID,
      classification: 'statement',
    })
  })

  it('stores the hash and consumes the token once', async () => {
    const issued = issueUploadToken({
      dealId: DEAL_ID,
      tenantId: TENANT_ID,
      organizationId: ORG_ID,
    })
    const store = new Map<string, unknown>()
    const cache = {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: unknown) => {
        store.set(key, value)
      },
      delete: async (key: string) => {
        store.delete(key)
      },
    }
    await persistUploadTokenHash(cache, issued)
    const first = await consumeUploadToken(cache, issued.token)
    expect(first?.dealId).toBe(DEAL_ID)
    const second = await consumeUploadToken(cache, issued.token)
    expect(second).toBeNull()
  })

  it('clamps ttl hours and compares secrets safely', () => {
    expect(resolveUploadTtlHours(0)).toBe(1)
    expect(resolveUploadTtlHours(9999)).toBe(24 * 30)
    expect(resolveUploadTtlHours('72')).toBe(72)
    expect(secretsMatch('abc', 'abc')).toBe(true)
    expect(secretsMatch('abc', 'abd')).toBe(false)
  })
})
