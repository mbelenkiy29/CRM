"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Plus } from 'lucide-react'
import { pipelineStatusVariant } from './statusVariant'

type DealRow = {
  id: string
  businessName: string | null
  pipelineStatus: string | null
  requestedAmount: string | null
  avgMonthlyRevenue: string | null
  updatedAt: string | null
}

type DealsResponse = {
  items?: DealRow[]
  total?: number
}

export default function MerchantAdvancesDealsPage() {
  const t = useT()
  const router = useRouter()
  const [rows, setRows] = React.useState<DealRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await readApiResultOrThrow<DealsResponse>(
          '/api/merchant_advances/deals?page=1&pageSize=50&sortField=updatedAt&sortDir=desc',
        )
        if (cancelled) return
        setRows(result.items ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const columns = React.useMemo<ColumnDef<DealRow>[]>(() => [
    {
      accessorKey: 'businessName',
      header: t('merchant_advances.deals.columns.businessName'),
      cell: ({ row }) => row.original.businessName ?? '—',
    },
    {
      accessorKey: 'pipelineStatus',
      header: t('merchant_advances.deals.columns.status'),
      cell: ({ row }) => {
        const status = row.original.pipelineStatus
        return (
          <StatusBadge variant={pipelineStatusVariant(status)}>
            {status ? t(`merchant_advances.status.${status}`) : '—'}
          </StatusBadge>
        )
      },
    },
    {
      accessorKey: 'requestedAmount',
      header: t('merchant_advances.deals.columns.requested'),
    },
    {
      accessorKey: 'avgMonthlyRevenue',
      header: t('merchant_advances.deals.columns.revenue'),
    },
  ], [t])

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('merchant_advances.deals.title')}
          columns={columns}
          data={rows}
          isLoading={loading}
          onRowClick={(row) => router.push(`/backend/merchant_advances?id=${row.id}`)}
          emptyState={(
            <ListEmptyState
              title={t('merchant_advances.deals.empty.title')}
              description={t('merchant_advances.deals.empty.description')}
              createHref="/backend/merchant_advances/create"
              createLabel={t('merchant_advances.deals.create')}
            />
          )}
          toolbar={(
            <Button asChild>
              <Link href="/backend/merchant_advances/create">
                <Plus className="size-4" />
                {t('merchant_advances.deals.create')}
              </Link>
            </Button>
          )}
        />
      </PageBody>
    </Page>
  )
}
