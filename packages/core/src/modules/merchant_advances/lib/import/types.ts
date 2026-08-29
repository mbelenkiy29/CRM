import type {
  McaAssignmentMethod,
  McaDocumentClassification,
  McaImportFieldKey,
  McaImportSource,
} from '../../data/constants'

export type SpreadsheetCell = string
export type SpreadsheetRow = SpreadsheetCell[]

export type ImportFileRef = {
  path: string
  name: string
  attachmentId?: string | null
}

export type MatchedImportFile = ImportFileRef & {
  classification: McaDocumentClassification
}

export type ColumnMap = Record<string, McaImportFieldKey | null>

export type SuggestColumnMapFn = (headers: string[]) => Partial<ColumnMap>

export type OriginatorDirectoryEntry = {
  name: string
  userId: string
}

export type MappedDealFields = {
  businessName: string | null
  requestedAmount: string | null
  avgMonthlyRevenue: string | null
  timeInBusinessMonths: number | null
  position: number | null
  industry: string | null
  state: string | null
  ein: string | null
  legalAddress: string | null
  originator: string | null
  folderName: string | null
  startDate: string | null
}

export type ApplicationPdfFields = Partial<MappedDealFields>

export type ImportPreviewRow = {
  rowIndex: number
  businessName: string | null
  fields: MappedDealFields
  pdfFilledFields: string[]
  files: MatchedImportFile[]
  ownerUserId: string | null
  originatorValue: string | null
  assignmentMethod: McaAssignmentMethod
  status: 'ready' | 'failed'
  failureReason: string | null
}

export type ImportPreviewResult = {
  source: McaImportSource
  dealCount: number
  failureCount: number
  headerRowIndex: number
  headers: string[]
  suggestedColumnMap: ColumnMap
  confirmedColumnMap: ColumnMap
  unmappedHeaders: string[]
  sensitiveHeaders: string[]
  rows: ImportPreviewRow[]
  unmatchedFiles: ImportFileRef[]
  assignmentMethod: McaAssignmentMethod
}

export type ImportCommitRow = ImportPreviewRow & {
  dealId?: string | null
}

export type ImportResultCsvRow = {
  rowIndex: number
  businessName: string | null
  dealId: string | null
  dealUrl: string | null
  ownerUserId: string | null
  assignmentMethod: string
  fileCount: number
  classifications: string
  status: string
  failureReason: string | null
  pdfFilledFields: string
}

export type ImportPersistenceDealInput = MappedDealFields & {
  ownerUserId: string | null
  assignmentMethod: McaAssignmentMethod
  leadSourceId: string | null
  leadBatchId: string | null
  merchantNameSnapshot: string | null
  merchantStateSnapshot: string | null
}

export type ImportPersistence = {
  createLeadSource: (name: string) => Promise<{ id: string }>
  createLeadBatch: (input: { name: string; leadSourceId: string | null; importJobId: string | null; leadCount: number }) => Promise<{ id: string }>
  saveMapping: (providerName: string, columnMap: ColumnMap) => Promise<{ id: string }>
  createImportJob: (input: {
    source: McaImportSource
    status: 'running' | 'completed' | 'failed'
    dealCount: number
    failureCount: number
    columnMap: ColumnMap
  }) => Promise<{ id: string }>
  completeImportJob: (id: string, input: { status: 'completed' | 'failed'; dealCount: number; failureCount: number }) => Promise<void>
  createDeal: (input: ImportPersistenceDealInput) => Promise<{ id: string }>
  createDocument: (input: { dealId: string; classification: McaDocumentClassification; attachmentId: string }) => Promise<void>
  updateRoundRobinCursor: (userId: string | null) => Promise<void>
}

export type CommitReviewedImportInput = {
  source: McaImportSource
  rows: ImportPreviewRow[]
  columnMap: ColumnMap
  assignmentMethod: McaAssignmentMethod
  leadSourceId?: string | null
  leadSourceName?: string | null
  leadBatchName?: string | null
  saveMappingAs?: string | null
  roundRobinCursorUserId?: string | null
}

export type CommitReviewedImportResult = {
  importJobId: string
  dealCount: number
  failureCount: number
  leadSourceId: string | null
  leadBatchId: string | null
  mappingId: string | null
  resultsCsv: string
  deals: Array<{ rowIndex: number; dealId: string; businessName: string }>
}
