import { createModuleQueue } from '@open-mercato/queue'

export const MCA_ANALYZE_STATEMENTS_QUEUE = 'merchant_advances.analyze-statements'

export type AnalyzeStatementJobPayload = {
  dealId: string
  tenantId: string
  organizationId: string
  attachmentId?: string | null
  documentId?: string | null
  force?: boolean
}

export function getAnalyzeStatementsQueue() {
  return createModuleQueue<AnalyzeStatementJobPayload>(MCA_ANALYZE_STATEMENTS_QUEUE, { concurrency: 2 })
}

export async function enqueueStatementAnalysis(payload: AnalyzeStatementJobPayload): Promise<void> {
  if (!payload.dealId || !payload.tenantId || !payload.organizationId) {
    throw new Error('[internal] statement analysis job is missing tenant scope')
  }
  await getAnalyzeStatementsQueue().enqueue(payload)
}
