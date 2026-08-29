import { createModuleQueue, type Queue } from '@open-mercato/queue'

export const MCA_IMPORT_COMMIT_QUEUE = 'merchant-advances-import-commit'

export type McaImportCommitScope = {
  organizationId: string
  tenantId: string
  userId?: string | null
}

export type McaImportCommitJobPayload = {
  progressJobId: string
  importJobId?: string | null
  source: string
  rows: unknown
  columnMap: unknown
  assignmentMethod: string
  leadSourceId?: string | null
  leadSourceName?: string | null
  leadBatchName?: string | null
  saveMappingAs?: string | null
  roundRobinCursorUserId?: string | null
  scope: McaImportCommitScope
}

const queues = new Map<string, Queue<Record<string, unknown>>>()

export function getMerchantAdvancesQueue(queueName: string): Queue<Record<string, unknown>> {
  const existing = queues.get(queueName)
  if (existing) return existing
  const concurrency = Math.max(
    1,
    Number.parseInt(process.env.MCA_IMPORT_QUEUE_CONCURRENCY ?? '1', 10) || 1,
  )
  const created = createModuleQueue<Record<string, unknown>>(queueName, { concurrency })
  queues.set(queueName, created)
  return created
}
