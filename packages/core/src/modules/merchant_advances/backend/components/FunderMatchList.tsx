"use client"

import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { TabEmptyState } from '@open-mercato/ui/backend/detail'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export type MatchReason = {
  code?: string
  passed?: boolean
  label?: string
}

export type FunderMatchRow = {
  id: string
  funderId: string | null
  funderName?: string | null
  score: string | null
  rank: number | null
  reasons: MatchReason[] | null
}

type FunderMatchListProps = {
  matches: FunderMatchRow[]
  selectedFunderIds: string[]
  onToggle: (funderId: string) => void
  onRefresh: () => void
  refreshing?: boolean
}

export function FunderMatchList({
  matches,
  selectedFunderIds,
  onToggle,
  onRefresh,
  refreshing,
}: FunderMatchListProps) {
  const t = useT()

  if (!matches.length) {
    return (
      <div className="flex flex-col gap-4">
        <TabEmptyState
          title={t('merchant_advances.detail.matches.empty')}
          description={t('merchant_advances.detail.matches.hint')}
        />
        <div>
          <Button type="button" onClick={onRefresh} disabled={refreshing}>
            {t('merchant_advances.detail.matches.refresh')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('merchant_advances.detail.matches.pickHint')}</p>
        <Button type="button" variant="outline" onClick={onRefresh} disabled={refreshing}>
          {t('merchant_advances.detail.matches.refresh')}
        </Button>
      </div>
      <ul className="space-y-3">
        {matches.map((match) => {
          const funderId = match.funderId
          const reasons = Array.isArray(match.reasons) ? match.reasons : []
          const passed = reasons.filter((reason) => reason.passed)
          return (
            <li key={match.id} className="rounded-md border border-border p-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={!funderId}
                  checked={Boolean(funderId && selectedFunderIds.includes(funderId))}
                  onChange={() => {
                    if (funderId) onToggle(funderId)
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {match.funderName ?? funderId ?? '—'}
                      {match.rank === 1 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t('merchant_advances.detail.matches.best', { score: match.score ?? '0' })}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {t('merchant_advances.detail.matches.score')}: {match.score ?? '0'}
                    </span>
                  </div>
                  {passed.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {passed.map((reason) => (
                        <span
                          key={`${match.id}-${reason.code ?? reason.label}`}
                          className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
                        >
                          {reason.label ?? reason.code}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
