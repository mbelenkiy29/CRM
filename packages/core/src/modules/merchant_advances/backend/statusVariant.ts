import type { StatusBadgeVariant } from '@open-mercato/ui/primitives/status-badge'

export function pipelineStatusVariant(status: string | null): StatusBadgeVariant {
  if (status === 'funded') return 'success'
  if (status === 'declined' || status === 'dead') return 'error'
  if (status === 'offered' || status === 'contracted') return 'info'
  if (status === 'submitted') return 'warning'
  return 'neutral'
}
