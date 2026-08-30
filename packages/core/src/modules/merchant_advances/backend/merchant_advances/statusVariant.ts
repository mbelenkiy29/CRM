import type { StatusBadgeVariant } from '@open-mercato/ui/primitives/status-badge'

export function pipelineStatusVariant(status: string | null): StatusBadgeVariant {
  if (status === 'funded') return 'success'
  if (status === 'declined' || status === 'dead') return 'error'
  if (status === 'offered' || status === 'contracted') return 'info'
  if (status === 'submitted') return 'warning'
  return 'neutral'
}

export function renewalStatusVariant(status: string | null): StatusBadgeVariant {
  if (status === 'renewed') return 'success'
  if (status === 'lost') return 'error'
  if (status === 'due') return 'warning'
  if (status === 'contacted') return 'info'
  return 'neutral'
}
