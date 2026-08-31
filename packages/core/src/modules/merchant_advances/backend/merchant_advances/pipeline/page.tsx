"use client"

import * as React from 'react'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { readApiResultOrThrow, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { McaPipelineStatus } from '../../../data/constants'
import { DealKanban, type KanbanDeal } from '../../components/DealKanban'
import { McaPageChrome } from '../../components/McaPageChrome'

type DealsResponse = {
  items?: KanbanDeal[]
}

export default function MerchantAdvancesPipelinePage() {
  const t = useT()
  const [rows, setRows] = React.useState<KanbanDeal[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await readApiResultOrThrow<DealsResponse>(
        '/api/merchant_advances/deals?page=1&pageSize=100&sortField=updatedAt&sortDir=desc',
      )
      setRows(result.items ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const { runMutation, retryLastMutation } = useGuardedMutation({
    contextId: 'merchant-advances-pipeline',
    blockedMessage: t('merchant_advances.errors.saveBlocked'),
  })

  const onMove = async (dealId: string, nextStatus: McaPipelineStatus) => {
    const deal = rows.find((row) => row.id === dealId)
    if (!deal) return
    try {
      await runMutation({
        operation: () => withScopedApiRequestHeaders(
          buildOptimisticLockHeader(deal.updatedAt),
          () => updateCrud('merchant_advances/deals', { id: dealId, pipelineStatus: nextStatus }),
        ),
        context: {
          formId: 'merchant-advances-pipeline',
          resourceKind: 'merchant_advances.deal',
          resourceId: dealId,
          retryLastMutation,
        },
      })
      await load()
    } catch (err) {
      surfaceRecordConflict(err, t, { onRefresh: load })
    }
  }

  return (
    <Page>
      <PageHeader title={t('merchant_advances.pipeline.title')} />
      <PageBody>
        <McaPageChrome />
        <div data-tour-id="pipeline-board">
          <DealKanban deals={rows} loading={loading} onMove={onMove} />
        </div>
      </PageBody>
    </Page>
  )
}
