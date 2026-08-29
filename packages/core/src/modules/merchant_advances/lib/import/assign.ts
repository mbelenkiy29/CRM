import type { McaAssignmentMethod } from '../../data/constants'
import { normalizeBusinessName, similarity } from './normalize'
import type { OriginatorDirectoryEntry } from './types'

export type AssignmentInput = {
  assignmentMethod: McaAssignmentMethod
  originatorValue: string | null
  originatorDirectory: OriginatorDirectoryEntry[]
  assigneeUserIds: string[]
  roundRobinCursorUserId?: string | null
}

export type AssignmentDecision = {
  ownerUserId: string | null
  method: McaAssignmentMethod
  failureReason: string | null
}

function nextRoundRobinUser(assigneeUserIds: string[], cursorUserId: string | null | undefined): string | null {
  if (assigneeUserIds.length === 0) return null
  if (!cursorUserId) return assigneeUserIds[0] ?? null
  const cursorIndex = assigneeUserIds.indexOf(cursorUserId)
  if (cursorIndex < 0) return assigneeUserIds[0] ?? null
  return assigneeUserIds[(cursorIndex + 1) % assigneeUserIds.length] ?? null
}

function matchOriginator(value: string, directory: OriginatorDirectoryEntry[]): string | null {
  const normalized = normalizeBusinessName(value)
  const exact = directory.find((entry) => normalizeBusinessName(entry.name) === normalized)
  if (exact) return exact.userId
  let best: OriginatorDirectoryEntry | null = null
  let bestScore = 0
  for (const entry of directory) {
    const score = similarity(value, entry.name)
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }
  return best && bestScore >= 0.78 ? best.userId : null
}

export function assignRow(input: AssignmentInput, priorCursorUserId: string | null): {
  decision: AssignmentDecision
  nextCursorUserId: string | null
} {
  if (input.assignmentMethod === 'originator_column') {
    if (!input.originatorValue) {
      return {
        decision: {
          ownerUserId: null,
          method: 'originator_column',
          failureReason: 'originator_missing',
        },
        nextCursorUserId: priorCursorUserId,
      }
    }
    const ownerUserId = matchOriginator(input.originatorValue, input.originatorDirectory)
    if (!ownerUserId) {
      return {
        decision: {
          ownerUserId: null,
          method: 'originator_column',
          failureReason: 'originator_unmatched',
        },
        nextCursorUserId: priorCursorUserId,
      }
    }
    return {
      decision: { ownerUserId, method: 'originator_column', failureReason: null },
      nextCursorUserId: priorCursorUserId,
    }
  }

  if (input.assignmentMethod === 'round_robin') {
    const ownerUserId = nextRoundRobinUser(input.assigneeUserIds, priorCursorUserId)
    if (!ownerUserId) {
      return {
        decision: {
          ownerUserId: null,
          method: 'round_robin',
          failureReason: 'assignees_missing',
        },
        nextCursorUserId: priorCursorUserId,
      }
    }
    return {
      decision: { ownerUserId, method: 'round_robin', failureReason: null },
      nextCursorUserId: ownerUserId,
    }
  }

  return {
    decision: { ownerUserId: null, method: input.assignmentMethod, failureReason: null },
    nextCursorUserId: priorCursorUserId,
  }
}

export function assignRows<T extends { originatorValue: string | null }>(
  rows: T[],
  input: Omit<AssignmentInput, 'originatorValue'>,
): { rows: Array<T & { ownerUserId: string | null; assignmentFailure: string | null }>; cursorUserId: string | null } {
  let cursor = input.roundRobinCursorUserId ?? null
  const assigned = rows.map((row) => {
    const result = assignRow({ ...input, originatorValue: row.originatorValue }, cursor)
    cursor = result.nextCursorUserId
    return {
      ...row,
      ownerUserId: result.decision.ownerUserId,
      assignmentFailure: result.decision.failureReason,
    }
  })
  return { rows: assigned, cursorUserId: cursor }
}
