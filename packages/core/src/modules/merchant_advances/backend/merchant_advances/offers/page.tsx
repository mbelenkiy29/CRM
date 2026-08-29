"use client"

import * as React from 'react'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type OfferRow = {
  id: string
  dealId: string | null
  amount: string | null
  factor: string | null
  termMonths: number | null
  paymentAmount: string | null
  status: string | null
  updatedAt: string | null
}

type OffersResponse = {
  items?: OfferRow[]
  total?: number
}

export default function MerchantAdvancesOffersPage() {
  const t = useT()
  const [rows, setRows] = React.useState<OfferRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await readApiResultOrThrow<OffersResponse>(
          '/api/merchant_advances/offers?page=1&pageSize=50&sortField=updatedAt&sortDir=desc',
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

  const columns = React.useMemo<ColumnDef<OfferRow>[]>(() => [
    {
      accessorKey: 'amount',
      header: t('merchant_advances.offers.columns.amount'),
      cell: ({ row }) => row.original.amount ?? '—',
    },
    {
      accessorKey: 'factor',
      header: t('merchant_advances.offers.columns.factor'),
      cell: ({ row }) => row.original.factor ?? '—',
    },
    {
      accessorKey: 'termMonths',
      header: t('merchant_advances.offers.columns.term'),
      cell: ({ row }) => row.original.termMonths ?? '—',
    },
    {
      accessorKey: 'paymentAmount',
      header: t('merchant_advances.offers.columns.payment'),
      cell: ({ row }) => row.original.paymentAmount ?? '—',
    },
    {
      accessorKey: 'status',
      header: t('merchant_advances.offers.columns.status'),
      cell: ({ row }) => row.original.status ?? '—',
    },
  ], [t])

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('merchant_advances.offers.title')}
          columns={columns}
          data={rows}
          isLoading={loading}
          emptyState={(
            <ListEmptyState
              title={t('merchant_advances.offers.empty.title')}
              description={t('merchant_advances.offers.empty.description')}
            />
          )}
        />
      </PageBody>
    </Page>
  )
}
