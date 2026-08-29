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
