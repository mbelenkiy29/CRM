"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import { ErrorMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { readApiResultOrThrow, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { Button } from '@open-mercato/ui/primitives/button'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { pipelineStatusVariant, renewalStatusVariant } from '../statusVariant'

type RenewalRow = {
  id: string
  dealId: string
  fundingId: string
  merchantName: string | null
  paidInPct: string | null
  remainingDays: number | null
  status: string
  fundedAt: string | null
  termMonths: number | null
  updatedAt: string | null
}

type PastApprovalRow = {
  dealId: string
  merchantName: string | null
  paidInPct: string | null
  fundedAt: string | null
  pipelineStatus: string
}

type QueueResponse = {
  items?: RenewalRow[]
  pastApproval?: PastApprovalRow[]
  threshold?: number
}

type CrudRenewal = {
  id: string
  updatedAt: string | null
}

const WRITEBACK = ['contacted', 'renewed', 'lost'] as const

function formatDate(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

export default function MerchantAdvancesRenewalsPage() {
  const t = useT()
  const router = useRouter()
  const emptyValue = t('merchant_advances.common.empty')
  const [rows, setRows] = React.useState<RenewalRow[]>([])
  const [pastApproval, setPastApproval] = React.useState<PastApprovalRow[]>([])
  const [versions, setVersions] = React.useState<Record<string, string | null>>({})
  const [threshold, setThreshold] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [queue, crud] = await Promise.all([
        readApiResultOrThrow<QueueResponse>(
          '/api/merchant_advances/renewals/queue?page=1&pageSize=50',
        ),
        readApiResultOrThrow<{ items?: CrudRenewal[] }>(
          '/api/merchant_advances/renewals?page=1&pageSize=100&sortField=updatedAt&sortDir=desc',
        ),
      ])
      setRows(queue.items ?? [])
      setPastApproval(queue.pastApproval ?? [])
      setThreshold(typeof queue.threshold === 'number' ? queue.threshold : null)
      const nextVersions: Record<string, string | null> = {}
      for (const row of crud.items ?? []) {
        nextVersions[row.id] = row.updatedAt ?? null
      }
      setVersions(nextVersions)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const { runMutation, retryLastMutation } = useGuardedMutation({
    contextId: 'merchant-advances-renewals',
    blockedMessage: t('merchant_advances.errors.saveBlocked'),
  })

  const writeStatus = React.useCallback(async (renewal: RenewalRow, status: string) => {
    try {
      await runMutation({
        operation: () => withScopedApiRequestHeaders(
          buildOptimisticLockHeader(versions[renewal.id] ?? renewal.updatedAt),
          () => updateCrud('merchant_advances/renewals', { id: renewal.id, status }),
        ),
        context: {
          formId: 'merchant-advances-renewals',
          resourceKind: 'merchant_advances.renewal',
          resourceId: renewal.id,
          retryLastMutation,
        },
      })
      flash(t('merchant_advances.detail.renewalUpdated'), 'success')
      await load()
    } catch (err) {
      surfaceRecordConflict(err, t, { onRefresh: load })
    }
  }, [load, runMutation, retryLastMutation, t, versions])

  const renewalColumns = React.useMemo<ColumnDef<RenewalRow>[]>(() => [
    {
      accessorKey: 'merchantName',
      header: t('merchant_advances.renewals.columns.merchant'),
      cell: ({ row }) => row.original.merchantName ?? emptyValue,
    },
    {
      accessorKey: 'paidInPct',
      header: t('merchant_advances.renewals.columns.paidIn'),
      cell: ({ row }) => (
        row.original.paidInPct
          ? t('merchant_advances.renewals.paidInValue', { value: row.original.paidInPct })
          : emptyValue
      ),
    },
    {
      accessorKey: 'remainingDays',
      header: t('merchant_advances.renewals.columns.remainingDays'),
      cell: ({ row }) => (
        row.original.remainingDays == null
          ? emptyValue
          : t('merchant_advances.renewals.remainingDaysValue', { count: Math.max(0, row.original.remainingDays) })
      ),
    },
    {
      accessorKey: 'status',
      header: t('merchant_advances.renewals.columns.status'),
      cell: ({ row }) => (
        <StatusBadge variant={renewalStatusVariant(row.original.status)}>
          {t(`merchant_advances.renewalStatus.${row.original.status}`)}
        </StatusBadge>
      ),
    },
    {
      accessorKey: 'fundedAt',
      header: t('merchant_advances.renewals.columns.fundedAt'),
      cell: ({ row }) => formatDate(row.original.fundedAt) || emptyValue,
    },
    {
      accessorKey: 'termMonths',
      header: t('merchant_advances.renewals.columns.term'),
      cell: ({ row }) => row.original.termMonths ?? emptyValue,
    },
    {
      id: 'writeback',
      header: t('merchant_advances.renewals.columns.actions'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          {WRITEBACK.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation()
                void writeStatus(row.original, status)
              }}
            >
              {t(`merchant_advances.renewal.${status}`)}
            </Button>
          ))}
        </div>
      ),
    },
  ], [emptyValue, t, writeStatus])

  const pastApprovalColumns = React.useMemo<ColumnDef<PastApprovalRow>[]>(() => [
    {
      accessorKey: 'merchantName',
      header: t('merchant_advances.renewals.columns.merchant'),
      cell: ({ row }) => row.original.merchantName ?? emptyValue,
    },
    {
      accessorKey: 'paidInPct',
      header: t('merchant_advances.renewals.columns.paidIn'),
      cell: ({ row }) => (
        row.original.paidInPct
          ? t('merchant_advances.renewals.paidInValue', { value: row.original.paidInPct })
          : emptyValue
      ),
    },
    {
      accessorKey: 'fundedAt',
      header: t('merchant_advances.renewals.columns.fundedAt'),
      cell: ({ row }) => formatDate(row.original.fundedAt) || emptyValue,
    },
    {
      accessorKey: 'pipelineStatus',
      header: t('merchant_advances.deals.columns.status'),
      cell: ({ row }) => (
        <StatusBadge variant={pipelineStatusVariant(row.original.pipelineStatus)}>
          {t(`merchant_advances.status.${row.original.pipelineStatus}`)}
        </StatusBadge>
      ),
    },
  ], [emptyValue, t])

  return (
    <Page>
      <PageHeader
        title={t('merchant_advances.renewals.title')}
        description={
          threshold == null
            ? t('merchant_advances.renewals.description')
            : t('merchant_advances.renewals.descriptionWithThreshold', { threshold })
        }
      />
      <PageBody>
        {error ? (
          <ErrorMessage label={t('merchant_advances.errors.loadFailed')} />
        ) : (
          <div className="flex flex-col gap-8">
            <DataTable
              title={t('merchant_advances.renewals.approaching.title')}
              columns={renewalColumns}
              data={rows}
              isLoading={loading}
              onRowClick={(row) => router.push(`/backend/merchant_advances/${row.dealId}`)}
              emptyState={(
                <ListEmptyState
                  title={t('merchant_advances.renewals.empty.title')}
                  description={t('merchant_advances.renewals.empty.description')}
                />
              )}
            />
            <DataTable
              title={t('merchant_advances.renewals.pastApproval.title')}
              columns={pastApprovalColumns}
              data={pastApproval}
              isLoading={loading}
              onRowClick={(row) => router.push(`/backend/merchant_advances/${row.dealId}`)}
              emptyState={(
                <ListEmptyState
                  title={t('merchant_advances.renewals.pastApproval.empty.title')}
                  description={t('merchant_advances.renewals.pastApproval.empty.description')}
                />
              )}
            />
          </div>
        )}
      </PageBody>
    </Page>
  )
}
