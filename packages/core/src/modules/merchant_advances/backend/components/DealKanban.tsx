"use client"

import * as React from 'react'
import Link from 'next/link'
import { FilterBar } from '@open-mercato/ui/backend/FilterBar'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { MCA_PIPELINE_STATUSES, type McaPipelineStatus } from '../../data/constants'
import { legalMoves } from '../../lib/pipeline'
import { pipelineStatusVariant } from '../merchant_advances/statusVariant'

export type KanbanDeal = {
  id: string
  businessName: string | null
  pipelineStatus: string | null
  requestedAmount: string | null
  paidInPct?: string | null
  updatedAt?: string | null
}

type DealKanbanProps = {
  deals: KanbanDeal[]
  loading?: boolean
  onMove: (dealId: string, nextStatus: McaPipelineStatus) => Promise<void>
}

export function DealKanban({ deals, loading, onMove }: DealKanbanProps) {
  const t = useT()
  const [search, setSearch] = React.useState('')
  const [stageFilter, setStageFilter] = React.useState<string>('')

  const visible = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return deals.filter((deal) => {
      if (stageFilter && deal.pipelineStatus !== stageFilter) return false
      if (!query) return true
      return (deal.businessName ?? '').toLowerCase().includes(query)
    })
  }, [deals, search, stageFilter])

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('merchant_advances.pipeline.search')}
        filters={[
          {
            id: 'stage',
            label: t('merchant_advances.deals.columns.status'),
            type: 'select',
            options: MCA_PIPELINE_STATUSES.map((status) => ({
              value: status,
              label: t(`merchant_advances.status.${status}`),
            })),
          },
        ]}
        values={stageFilter ? { stage: stageFilter } : {}}
        onApply={(values) => setStageFilter(typeof values.stage === 'string' ? values.stage : '')}
        onClear={() => setStageFilter('')}
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('merchant_advances.common.loading')}</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {MCA_PIPELINE_STATUSES.map((status) => {
            const columnRows = visible.filter((row) => row.pipelineStatus === status)
            return (
              <section
                key={status}
                className="w-72 shrink-0 rounded-lg border border-border bg-card p-3"
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
                    {columnRows.map((row) => {
                      const current = (row.pipelineStatus ?? 'new_app') as McaPipelineStatus
                      const moves = legalMoves(current)
                      return (
                        <li key={row.id} className="rounded-md border border-border bg-background p-3">
                          <Link
                            href={`/backend/merchant_advances/${row.id}`}
                            className="block text-sm font-medium hover:underline"
                          >
                            {row.businessName ?? '—'}
                          </Link>
                          {row.requestedAmount ? (
                            <div className="text-xs text-muted-foreground">{row.requestedAmount}</div>
                          ) : null}
                          {current === 'funded' && row.paidInPct ? (
                            <div className="text-xs text-muted-foreground">
                              {t('merchant_advances.pipeline.paidIn')}: {row.paidInPct}%
                            </div>
                          ) : null}
                          {moves.length ? (
                            <label className="mt-2 block text-xs text-muted-foreground">
                              {t('merchant_advances.pipeline.move')}
                              <select
                                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                                defaultValue=""
                                onChange={(event) => {
                                  const next = event.target.value as McaPipelineStatus
                                  event.target.value = ''
                                  if (next) void onMove(row.id, next)
                                }}
                              >
                                <option value="">{t('merchant_advances.pipeline.movePlaceholder')}</option>
                                {moves.map((next) => (
                                  <option key={next} value={next}>
                                    {t(`merchant_advances.status.${next}`)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
