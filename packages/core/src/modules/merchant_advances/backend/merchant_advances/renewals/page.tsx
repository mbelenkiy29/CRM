"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import { ErrorMessage } from '@open-mercato/ui/backend/detail'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
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
}

type PastApprovalRow = {
  dealId: string
  merchantName: string | null
  paidInPct: string | null
  fundedAt: string | null
  pipelineStatus: string
}

type RenewalsResponse = {
  items?: RenewalRow[]
  pastApproval?: PastApprovalRow[]
  total?: number
  pastApprovalTotal?: number
  threshold?: number
}

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
  const [threshold, setThreshold] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await readApiResultOrThrow<RenewalsResponse>(
          '/api/merchant_advances/renewals?page=1&pageSize=50',
        )
        if (cancelled) return
        setRows(result.items ?? [])
        setPastApproval(result.pastApproval ?? [])
        setThreshold(typeof result.threshold === 'number' ? result.threshold : null)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
  ], [emptyValue, t])

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
          <>
            <DataTable
              title={t('merchant_advances.renewals.approaching.title')}
              columns={renewalColumns}
              data={rows}
              isLoading={loading}
              onRowClick={(row) => router.push(`/backend/merchant_advances?id=${row.dealId}`)}
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
              onRowClick={(row) => router.push(`/backend/merchant_advances?id=${row.dealId}`)}
              emptyState={(
                <ListEmptyState
                  title={t('merchant_advances.renewals.pastApproval.empty.title')}
                  description={t('merchant_advances.renewals.pastApproval.empty.description')}
                />
              )}
            />
          </>
        )}
      </PageBody>
    </Page>
  )
}
