import { buildResultsCsv, toResultCsvRow } from './resultsCsv'
import type {
  CommitReviewedImportInput,
  CommitReviewedImportResult,
  ImportPersistence,
  ImportPreviewRow,
} from './types'

function readyRows(rows: ImportPreviewRow[]): ImportPreviewRow[] {
  return rows.filter((row) => row.status === 'ready' && row.businessName)
}

export async function commitReviewedImport(
  input: CommitReviewedImportInput,
  persistence: ImportPersistence,
): Promise<CommitReviewedImportResult> {
  const ready = readyRows(input.rows)
  const failed = input.rows.filter((row) => row.status === 'failed')

  const leadSource = input.leadSourceId
    ? { id: input.leadSourceId }
    : input.leadSourceName
      ? await persistence.createLeadSource(input.leadSourceName)
      : null

  const job = await persistence.createImportJob({
    source: input.source,
    status: 'running',
    dealCount: ready.length,
    failureCount: failed.length,
    columnMap: input.columnMap,
  })

  const leadBatch = input.leadBatchName
    ? await persistence.createLeadBatch({
        name: input.leadBatchName,
        leadSourceId: leadSource?.id ?? null,
        importJobId: job.id,
        leadCount: ready.length,
      })
    : null

  const mapping = input.saveMappingAs
    ? await persistence.saveMapping(input.saveMappingAs, input.columnMap)
    : null

  const deals: Array<{ rowIndex: number; dealId: string; businessName: string }> = []
  const resultRows = []
  let lastOwner: string | null = input.roundRobinCursorUserId ?? null

  for (const row of input.rows) {
    if (row.status !== 'ready' || !row.businessName) {
      resultRows.push(toResultCsvRow(row, null))
      continue
    }
    const created = await persistence.createDeal({
      ...row.fields,
      ownerUserId: row.ownerUserId,
      assignmentMethod: row.assignmentMethod,
      leadSourceId: leadSource?.id ?? null,
      leadBatchId: leadBatch?.id ?? null,
      merchantNameSnapshot: row.businessName,
      merchantStateSnapshot: row.fields.state,
    })
    for (const file of row.files) {
      if (!file.attachmentId) continue
      await persistence.createDocument({
        dealId: created.id,
        classification: file.classification,
        attachmentId: file.attachmentId,
      })
    }
    if (row.ownerUserId) lastOwner = row.ownerUserId
    deals.push({ rowIndex: row.rowIndex, dealId: created.id, businessName: row.businessName })
    resultRows.push(toResultCsvRow({ ...row, status: 'ready' }, created.id))
  }

  if (input.assignmentMethod === 'round_robin') {
    await persistence.updateRoundRobinCursor(lastOwner)
  }

  await persistence.completeImportJob(job.id, {
    status: 'completed',
    dealCount: deals.length,
    failureCount: failed.length,
  })

  return {
    importJobId: job.id,
    dealCount: deals.length,
    failureCount: failed.length,
    leadSourceId: leadSource?.id ?? null,
    leadBatchId: leadBatch?.id ?? null,
    mappingId: mapping?.id ?? null,
    resultsCsv: buildResultsCsv(resultRows),
    deals,
  }
}
