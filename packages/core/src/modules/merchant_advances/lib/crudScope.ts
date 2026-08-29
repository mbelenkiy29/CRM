import { z } from 'zod'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CrudCtx } from '@open-mercato/shared/lib/crud/factory'

export const rawBodySchema = z.object({}).passthrough()

export function scopeFromContext(ctx: CrudCtx): { organizationId: string; tenantId: string } {
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  const tenantId = ctx.auth?.tenantId ?? null
  if (!organizationId || !tenantId) {
    throw new CrudHttpError(400, { error: '[internal] merchant advances scope is missing' })
  }
  return { organizationId, tenantId }
}

export function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function readString(record: Record<string, unknown>, snakeKey: string, camelKey: string): string | null {
  const value = record[snakeKey] ?? record[camelKey]
  return typeof value === 'string' ? value : null
}

export function readNumber(record: Record<string, unknown>, snakeKey: string, camelKey: string): number | null {
  const value = record[snakeKey] ?? record[camelKey]
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function readBool(record: Record<string, unknown>, snakeKey: string, camelKey: string, fallback = false): boolean {
  const value = record[snakeKey] ?? record[camelKey]
  if (value === true || value === false) return value
  return fallback
}

export function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toISOString()
  }
  return null
}

export function toNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function toNullableDecimal(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key)
}
