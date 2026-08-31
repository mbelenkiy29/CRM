import { randomBytes } from 'node:crypto'

export function generateIntakeSecret(): string {
  return `mca_${randomBytes(24).toString('base64url')}`
}

export function extrasStubStatus(configured: boolean): 'configured_not_sending' | 'not_configured' {
  return configured ? 'configured_not_sending' : 'not_configured'
}
