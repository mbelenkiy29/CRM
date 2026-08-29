"use client"

import * as React from 'react'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type FunderRow = {
  id: string
  name: string | null
  submitMethod: string | null
}

type FundersResponse = {
  items?: FunderRow[]
  total?: number
}

export default function MerchantAdvancesFundersPage() {
  const t = useT()
  const [rows, setRows] = React.useState<FunderRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await readApiResultOrThrow<FundersResponse>(
          '/api/merchant_advances/funders?page=1&pageSize=50&sortField=name&sortDir=asc',
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

  const columns = React.useMemo<ColumnDef<FunderRow>[]>(() => [
    {
      accessorKey: 'name',
      header: t('merchant_advances.funders.columns.name'),
      cell: ({ row }) => row.original.name ?? '—',
    },
    {
      accessorKey: 'submitMethod',
      header: t('merchant_advances.funders.columns.method'),
      cell: ({ row }) => {
        const method = row.original.submitMethod
        return method ? t(`merchant_advances.method.${method}`) : '—'
      },
    },
  ], [t])

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('merchant_advances.funders.title')}
          columns={columns}
          data={rows}
          isLoading={loading}
          emptyState={(
            <ListEmptyState
              title={t('merchant_advances.funders.empty.title')}
              description={t('merchant_advances.funders.empty.description')}
            />
          )}
        />
      </PageBody>
    </Page>
  )
}
