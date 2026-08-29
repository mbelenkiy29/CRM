"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { apiCall, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-mercato/ui/primitives/select'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { useT } from '@open-mercato/shared/lib/i18n/context'

const FIELD_KEYS = [
  'businessName',
  'requestedAmount',
  'avgMonthlyRevenue',
  'timeInBusinessMonths',
  'timeInBusinessYears',
  'position',
  'industry',
  'state',
  'ein',
  'legalAddress',
  'originator',
  'folderName',
  'startDate',
] as const

type ImportFieldKey = (typeof FIELD_KEYS)[number]
type ColumnMap = Record<string, ImportFieldKey | null>
type AssignmentMethod = 'manual' | 'round_robin' | 'originator_column' | 'form_rule'

type PreviewFile = {
  path: string
  name: string
  classification: string
}

type PreviewRow = {
  rowIndex: number
  businessName: string | null
  fields: Record<string, string | number | null>
  pdfFilledFields: string[]
  files: PreviewFile[]
  ownerUserId: string | null
  originatorValue: string | null
  assignmentMethod: AssignmentMethod
  status: 'ready' | 'failed'
  failureReason: string | null
}

type PreviewResponse = {
  dealCount: number
  failureCount: number
  headerRowIndex: number
  headers: string[]
  suggestedColumnMap: ColumnMap
  confirmedColumnMap: ColumnMap
  unmappedHeaders: string[]
  sensitiveHeaders: string[]
  rows: PreviewRow[]
  unmatchedFiles: Array<{ path: string; name: string }>
  assignmentMethod: AssignmentMethod
}

type CommitResponse = {
  ok?: boolean
  progressJobId?: string | null
  importJobId?: string | null
  dealCount?: number
  failureCount?: number
  resultsCsv?: string | null
  dealIds?: string[]
  error?: string
}

type SavedMapping = {
  id: string
  providerName: string
  columnMap: ColumnMap
}

function parseFilePaths(value: string): Array<{ path: string; name: string }> {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((path) => ({
      path,
      name: path.replace(/\\/g, '/').split('/').pop() ?? path,
    }))
}

function parseUuidList(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter((item) => /^[0-9a-f-]{36}$/i.test(item))
}

function parseOriginatorDirectory(value: string): Array<{ name: string; userId: string }> {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [name, userId] = line.split('=').map((part) => part.trim())
      if (!name || !userId || !/^[0-9a-f-]{36}$/i.test(userId)) return null
      return { name, userId }
    })
    .filter((entry): entry is { name: string; userId: string } => entry !== null)
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function MerchantAdvancesImportsPage() {
  const t = useT()
  const router = useRouter()
  const { runMutation } = useGuardedMutation({ contextId: 'merchant_advances.imports.commit' })

  const [spreadsheetText, setSpreadsheetText] = React.useState('')
  const [filename, setFilename] = React.useState('leads.csv')
  const [filePaths, setFilePaths] = React.useState('')
  const [assignmentMethod, setAssignmentMethod] = React.useState<AssignmentMethod>('round_robin')
  const [assigneeUserIds, setAssigneeUserIds] = React.useState('')
  const [originatorDirectory, setOriginatorDirectory] = React.useState('')
  const [leadSourceName, setLeadSourceName] = React.useState('')
  const [leadBatchName, setLeadBatchName] = React.useState('')
  const [saveMappingAs, setSaveMappingAs] = React.useState('')
  const [columnMap, setColumnMap] = React.useState<ColumnMap>({})
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null)
  const [resultsCsv, setResultsCsv] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [savedMappings, setSavedMappings] = React.useState<SavedMapping[]>([])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await readApiResultOrThrow<{ items?: SavedMapping[] }>(
          '/api/merchant_advances/imports/mappings',
        )
        if (!cancelled) setSavedMappings(result.items ?? [])
      } catch {
        if (!cancelled) setSavedMappings([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const runPreview = React.useCallback(async () => {
    setError(null)
    setResultsCsv(null)
    setLoading(true)
    try {
      const result = await readApiResultOrThrow<PreviewResponse>('/api/merchant_advances/imports/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: filename.toLowerCase().endsWith('.tsv') ? 'tsv' : 'csv',
          spreadsheetText,
          filename,
          columnMap: Object.keys(columnMap).length ? columnMap : undefined,
          files: parseFilePaths(filePaths),
          assignmentMethod,
          assigneeUserIds: parseUuidList(assigneeUserIds),
          originatorDirectory: parseOriginatorDirectory(originatorDirectory),
          leadSourceName: leadSourceName || undefined,
        }),
      })
      setPreview(result)
      setColumnMap(result.confirmedColumnMap)
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : t('merchant_advances.imports.errors.previewFailed'))
    } finally {
      setLoading(false)
    }
  }, [
    assignmentMethod,
    assigneeUserIds,
    columnMap,
    filePaths,
    filename,
    leadSourceName,
    originatorDirectory,
    spreadsheetText,
    t,
  ])

  const runCommit = React.useCallback(async () => {
    if (!preview) return
    setError(null)
    setLoading(true)
    try {
      const call = await runMutation({
        operation: () => apiCall<CommitResponse>('/api/merchant_advances/imports/commit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            source: filename.toLowerCase().endsWith('.tsv') ? 'tsv' : 'csv',
            rows: preview.rows,
            columnMap: preview.confirmedColumnMap,
            assignmentMethod: preview.assignmentMethod,
            leadSourceName: leadSourceName || undefined,
            leadBatchName: leadBatchName || undefined,
            saveMappingAs: saveMappingAs || undefined,
          }),
        }),
        context: { formId: 'merchant_advances.imports.commit' },
        mutationPayload: { dealCount: preview.dealCount },
      })
      if (!call.ok || !call.result?.ok) {
        setError(call.result?.error ?? t('merchant_advances.imports.errors.commitFailed'))
        return
      }
      if (call.result.resultsCsv) {
        setResultsCsv(call.result.resultsCsv)
        downloadCsv('mca-import-results.csv', call.result.resultsCsv)
      }
      flash(t('merchant_advances.imports.commitSuccess', { count: call.result.dealCount ?? preview.dealCount }), 'success')
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : t('merchant_advances.imports.errors.commitFailed'))
    } finally {
      setLoading(false)
    }
  }, [filename, leadBatchName, leadSourceName, preview, runMutation, saveMappingAs, t])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        router.push('/backend/merchant_advances')
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        if (preview) void runCommit()
        else void runPreview()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [preview, router, runCommit, runPreview])

  const columns = React.useMemo<ColumnDef<PreviewRow>[]>(() => [
    {
      accessorKey: 'businessName',
      header: t('merchant_advances.deals.columns.businessName'),
      cell: ({ row }) => row.original.businessName ?? '—',
    },
    {
      accessorKey: 'status',
      header: t('merchant_advances.deals.columns.status'),
      cell: ({ row }) => (
        <StatusBadge variant={row.original.status === 'ready' ? 'success' : 'error'}>
          {t(`merchant_advances.imports.rowStatus.${row.original.status}`)}
        </StatusBadge>
      ),
    },
    {
      accessorKey: 'ownerUserId',
      header: t('merchant_advances.imports.columns.assignee'),
      cell: ({ row }) => row.original.ownerUserId ?? '—',
    },
    {
      id: 'files',
      header: t('merchant_advances.imports.columns.files'),
      cell: ({ row }) => String(row.original.files.length),
    },
    {
      accessorKey: 'failureReason',
      header: t('merchant_advances.imports.columns.failure'),
      cell: ({ row }) => row.original.failureReason
        ? t(`merchant_advances.imports.failures.${row.original.failureReason}`)
        : '—',
    },
  ], [t])

  return (
    <Page>
      <PageHeader
        title={t('merchant_advances.imports.title')}
        description={t('merchant_advances.imports.description')}
      />
      <PageBody>
        <div className="flex max-w-5xl flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mca-import-file">{t('merchant_advances.imports.fields.spreadsheet')}</Label>
              <Input
                id="mca-import-file"
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setFilename(file.name)
                  void file.text().then(setSpreadsheetText)
                }}
              />
              <Textarea
                value={spreadsheetText}
                onChange={(event) => setSpreadsheetText(event.target.value)}
                rows={8}
                placeholder={t('merchant_advances.imports.fields.spreadsheetPlaceholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mca-import-files">{t('merchant_advances.imports.fields.filePaths')}</Label>
              <Textarea
                id="mca-import-files"
                value={filePaths}
                onChange={(event) => setFilePaths(event.target.value)}
                rows={8}
                placeholder={t('merchant_advances.imports.fields.filePathsPlaceholder')}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>{t('merchant_advances.imports.fields.assignmentMethod')}</Label>
              <Select value={assignmentMethod} onValueChange={(value) => setAssignmentMethod(value as AssignmentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">{t('merchant_advances.imports.assignment.round_robin')}</SelectItem>
                  <SelectItem value="originator_column">{t('merchant_advances.imports.assignment.originator_column')}</SelectItem>
                  <SelectItem value="manual">{t('merchant_advances.imports.assignment.manual')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mca-import-assignees">{t('merchant_advances.imports.fields.assignees')}</Label>
              <Input
                id="mca-import-assignees"
                value={assigneeUserIds}
                onChange={(event) => setAssigneeUserIds(event.target.value)}
                placeholder={t('merchant_advances.imports.fields.assigneesPlaceholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mca-import-originators">{t('merchant_advances.imports.fields.originators')}</Label>
              <Textarea
                id="mca-import-originators"
                value={originatorDirectory}
                onChange={(event) => setOriginatorDirectory(event.target.value)}
                rows={3}
                placeholder={t('merchant_advances.imports.fields.originatorsPlaceholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mca-import-source">{t('merchant_advances.imports.fields.leadSource')}</Label>
              <Input
                id="mca-import-source"
                value={leadSourceName}
                onChange={(event) => setLeadSourceName(event.target.value)}
              />
              <Label htmlFor="mca-import-batch">{t('merchant_advances.imports.fields.leadBatch')}</Label>
              <Input
                id="mca-import-batch"
                value={leadBatchName}
                onChange={(event) => setLeadBatchName(event.target.value)}
              />
              <Label htmlFor="mca-import-mapping">{t('merchant_advances.imports.fields.saveMapping')}</Label>
              <Input
                id="mca-import-mapping"
                value={saveMappingAs}
                onChange={(event) => setSaveMappingAs(event.target.value)}
                placeholder={t('merchant_advances.imports.fields.saveMappingPlaceholder')}
              />
              {savedMappings.length > 0 ? (
                <Select
                  onValueChange={(value) => {
                    const mapping = savedMappings.find((item) => item.id === value)
                    if (mapping) setColumnMap(mapping.columnMap)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('merchant_advances.imports.fields.savedMapping')} />
                  </SelectTrigger>
                  <SelectContent>
                    {savedMappings.map((mapping) => (
                      <SelectItem key={mapping.id} value={mapping.id}>{mapping.providerName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void runPreview()} disabled={loading || !spreadsheetText.trim()}>
              {t('merchant_advances.imports.actions.preview')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/backend/merchant_advances')}
            >
              {t('merchant_advances.imports.actions.cancel')}
            </Button>
          </div>

          {loading ? <LoadingMessage label={t('merchant_advances.common.loading')} /> : null}
          {error ? <ErrorMessage label={error} /> : null}

          {preview ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t('merchant_advances.imports.reviewSummary', {
                  deals: preview.dealCount,
                  failures: preview.failureCount,
                })}
              </p>
              {preview.sensitiveHeaders.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('merchant_advances.imports.sensitiveSkipped', {
                    headers: preview.sensitiveHeaders.join(', '),
                  })}
                </p>
              ) : null}
              <div className="grid gap-3">
                {preview.headers.filter((header) => header.trim()).map((header) => (
                  <div key={header} className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <span className="text-sm">{header}</span>
                    <Select
                      value={columnMap[header] ?? '__skip__'}
                      onValueChange={(value) => {
                        setColumnMap((current) => ({
                          ...current,
                          [header]: value === '__skip__' ? null : value as ImportFieldKey,
                        }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">{t('merchant_advances.imports.mapping.skip')}</SelectItem>
                        {FIELD_KEYS.map((field) => (
                          <SelectItem key={field} value={field}>
                            {t(`merchant_advances.imports.fields.${field}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={() => void runPreview()} disabled={loading}>
                {t('merchant_advances.imports.actions.remap')}
              </Button>
              <DataTable
                title={t('merchant_advances.imports.reviewTitle')}
                columns={columns}
                data={preview.rows}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void runCommit()} disabled={loading || preview.dealCount === 0}>
                  {t('merchant_advances.imports.actions.commit')}
                </Button>
                {resultsCsv ? (
                  <Button type="button" variant="outline" onClick={() => downloadCsv('mca-import-results.csv', resultsCsv)}>
                    {t('merchant_advances.imports.actions.downloadResults')}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </PageBody>
    </Page>
  )
}
