import type { EntityManager } from '@mikro-orm/postgresql'
import type { McaAssignmentMethod } from '../../data/constants'
import { McaWorkspaceSettings } from '../../data/entities'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AssignmentDecision = {
  ownerUserId: string | null
  assignmentMethod: McaAssignmentMethod
  nextCursorUserId: string | null
  settings: McaWorkspaceSettings | null
}

type UsersTable = {
  users: {
    id: string
    tenant_id: string | null
    organization_id: string | null
    is_confirmed: boolean
    deleted_at: Date | null
  }
}

export function pickRoundRobinOwner(
  userIds: readonly string[],
  cursorUserId: string | null,
): { ownerUserId: string | null; nextCursorUserId: string | null } {
  if (!userIds.length) return { ownerUserId: null, nextCursorUserId: cursorUserId }
  const sorted = [...userIds].sort((left, right) => left.localeCompare(right))
  const cursorIndex = cursorUserId ? sorted.indexOf(cursorUserId) : -1
  const nextIndex = cursorIndex >= 0 ? (cursorIndex + 1) % sorted.length : 0
  const ownerUserId = sorted[nextIndex] ?? null
  return { ownerUserId, nextCursorUserId: ownerUserId }
}

export async function listAssignableUserIds(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
): Promise<string[]> {
  const db = em.getKysely<UsersTable>()
  try {
    const rows = await db
      .selectFrom('users')
      .select(['id'])
      .where('tenant_id', '=', scope.tenantId)
      .where((eb) => eb.or([
        eb('organization_id', '=', scope.organizationId),
        eb('organization_id', 'is', null),
      ]))
      .where('deleted_at', 'is', null)
      .where('is_confirmed', '=', true)
      .orderBy('id', 'asc')
      .execute()
    return rows.map((row) => row.id).filter((id) => UUID_RE.test(id))
  } catch (err) {
    if (isMissingTableError(err)) return []
    throw err
  }
}

export async function resolveIntakeAssignment(input: {
  em: EntityManager
  scope: { tenantId: string; organizationId: string }
  mappedOwnerUserId: string | null
}): Promise<AssignmentDecision> {
  let settings = await input.em.findOne(McaWorkspaceSettings, {
    tenantId: input.scope.tenantId,
    organizationId: input.scope.organizationId,
    deletedAt: null,
  })
  if (input.mappedOwnerUserId && UUID_RE.test(input.mappedOwnerUserId)) {
    return {
      ownerUserId: input.mappedOwnerUserId,
      assignmentMethod: 'form_rule',
      nextCursorUserId: null,
      settings,
    }
  }
  if (!settings) {
    settings = input.em.create(McaWorkspaceSettings, {
      tenantId: input.scope.tenantId,
      organizationId: input.scope.organizationId,
    })
  }
  const roster = await listAssignableUserIds(input.em, input.scope)
  const picked = pickRoundRobinOwner(roster, settings.roundRobinCursorUserId ?? null)
  if (picked.nextCursorUserId) settings.roundRobinCursorUserId = picked.nextCursorUserId
  return {
    ownerUserId: picked.ownerUserId,
    assignmentMethod: picked.ownerUserId ? 'round_robin' : 'manual',
    nextCursorUserId: picked.nextCursorUserId,
    settings,
  }
}

function isMissingTableError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const candidate = err as { code?: unknown; message?: unknown }
  return candidate.code === '42P01'
    || (typeof candidate.message === 'string' && candidate.message.includes('does not exist'))
}
