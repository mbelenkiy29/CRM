import { MCA_LEGAL_TRANSITIONS, type McaPipelineStatus } from '../data/constants'

export function assertStageTransition(from: McaPipelineStatus, to: McaPipelineStatus): void {
  if (from === to) return
  const allowed = MCA_LEGAL_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw new Error(`[internal] illegal MCA stage transition ${from} -> ${to}`)
  }
}

export function canTransition(from: McaPipelineStatus, to: McaPipelineStatus): boolean {
  if (from === to) return true
  return MCA_LEGAL_TRANSITIONS[from].includes(to)
}

export function legalMoves(from: McaPipelineStatus): McaPipelineStatus[] {
  return [...MCA_LEGAL_TRANSITIONS[from]]
}

export function shortestLegalPath(from: McaPipelineStatus, to: McaPipelineStatus): McaPipelineStatus[] | null {
  if (from === to) return []
  const queue: McaPipelineStatus[][] = [[from]]
  const seen = new Set<McaPipelineStatus>([from])
  while (queue.length) {
    const path = queue.shift()
    if (!path) break
    const current = path[path.length - 1]
    if (!current) break
    for (const next of MCA_LEGAL_TRANSITIONS[current]) {
      if (seen.has(next)) continue
      if (next === to) return [...path.slice(1), next]
      seen.add(next)
      queue.push([...path, next])
    }
  }
  return null
}

export function applyLegalPath(from: McaPipelineStatus, hops: McaPipelineStatus[]): McaPipelineStatus {
  return hops.reduce((current, next) => {
    assertStageTransition(current, next)
    return next
  }, from)
}
