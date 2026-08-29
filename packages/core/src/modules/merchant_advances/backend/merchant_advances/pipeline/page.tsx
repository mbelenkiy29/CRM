"use client"

import * as React from 'react'
import Link from 'next/link'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { MCA_PIPELINE_STATUSES } from '../../../data/constants'
import { pipelineStatusVariant } from '../statusVariant'

type DealRow = {
  id: string
  businessName: string | null
  pipelineStatus: string | null
  requestedAmount: string | null
}

type DealsResponse = {
  items?: DealRow[]
}

export default function MerchantAdvancesPipelinePage() {
  const t = useT()
  const [rows, setRows] = React.useState<DealRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await readApiResultOrThrow<DealsResponse>(
          '/api/merchant_advances/deals?page=1&pageSize=100&sortField=updatedAt&sortDir=desc',
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

  return (
    <Page>
      <PageHeader title={t('merchant_advances.pipeline.title')} />
      <PageBody>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('merchant_advances.common.loading')}</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {MCA_PIPELINE_STATUSES.map((status) => {
              const columnRows = rows.filter((row) => row.pipelineStatus === status)
              return (
                <section
                  key={status}
                  className="w-64 shrink-0 rounded-lg border border-border bg-card p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <StatusBadge variant={pipelineStatusVariant(status)}>
                      {t(`merchant_advances.status.${status}`)}
                    </StatusBadge>
                    <span className="text-xs text-muted-foreground">{columnRows.length}</span>
                  </div>
                  {columnRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('merchant_advances.pipeline.empty')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {columnRows.map((row) => (
                        <li key={row.id}>
                          <Link
                            href={`/backend/merchant_advances?id=${row.id}`}
                            className="block rounded-md border border-border bg-background p-3 hover:bg-muted"
                          >
                            <div className="text-sm font-medium">{row.businessName ?? '—'}</div>
                            {row.requestedAmount ? (
                              <div className="text-xs text-muted-foreground">{row.requestedAmount}</div>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </PageBody>
    </Page>
  )
}
