"use client"

import * as React from 'react'
import Link from 'next/link'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { readApiResultOrThrow, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { Button } from '@open-mercato/ui/primitives/button'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type RenewalRow = {
  id: string
  dealId: string | null
  status: string | null
  paidInPct: string | null
  updatedAt: string | null
}

type DealRow = {
  id: string
  businessName: string | null
}

type ListResponse<T> = { items?: T[] }

const WRITEBACK = ['contacted', 'renewed', 'lost'] as const

export default function MerchantAdvancesRenewalsPage() {
  const t = useT()
  const [rows, setRows] = React.useState<RenewalRow[]>([])
  const [deals, setDeals] = React.useState<DealRow[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [renewalsRes, dealsRes] = await Promise.all([
        readApiResultOrThrow<ListResponse<RenewalRow>>(
          '/api/merchant_advances/renewals?page=1&pageSize=100&sortField=updatedAt&sortDir=desc',
        ),
        readApiResultOrThrow<ListResponse<DealRow>>(
          '/api/merchant_advances/deals?page=1&pageSize=100&sortField=updatedAt&sortDir=desc',
        ),
      ])
      setRows(renewalsRes.items ?? [])
      setDeals(dealsRes.items ?? [])
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

  const writeStatus = async (renewal: RenewalRow, status: string) => {
    try {
      await runMutation({
        operation: () => withScopedApiRequestHeaders(
          buildOptimisticLockHeader(renewal.updatedAt),
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
  }

  const dealName = (dealId: string | null) => {
    if (!dealId) return '—'
    return deals.find((deal) => deal.id === dealId)?.businessName ?? dealId
  }

  return (
    <Page>
      <PageHeader title={t('merchant_advances.renewals.title')} />
      <PageBody>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('merchant_advances.common.loading')}</p>
        ) : rows.length === 0 ? (
          <ListEmptyState
            title={t('merchant_advances.renewals.empty.title')}
            description={t('merchant_advances.renewals.empty.description')}
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((renewal) => (
              <li key={renewal.id} className="rounded-md border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={renewal.dealId ? `/backend/merchant_advances/${renewal.dealId}` : '/backend/merchant_advances'}
                    className="text-sm font-medium hover:underline"
                  >
                    {dealName(renewal.dealId)}
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {t('merchant_advances.pipeline.paidIn')}: {renewal.paidInPct ?? '0'}%
                    </span>
                    <StatusBadge variant="info">
                      {renewal.status ? t(`merchant_advances.renewal.${renewal.status}`) : '—'}
                    </StatusBadge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {WRITEBACK.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void writeStatus(renewal, status)}
                    >
                      {t(`merchant_advances.renewal.${status}`)}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </Page>
  )
}
