"use client"

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { Input } from '@open-mercato/ui/primitives/input'
import { splitCommissionAmounts } from '../../lib/money'
import { MCA_DEFAULT_OWNER_SPLIT_ROLE, splitPointsMatchParent, toPointsUnits } from '../../lib/funding'

export type CommissionSplitRow = {
  userId: string | null
  role: string | null
  points: string
  amount?: string | null
}

type CommissionSplitsProps = {
  splits: CommissionSplitRow[]
  parentPoints: string
  parentAmount?: string | null
  onChange?: (splits: CommissionSplitRow[]) => void
  readOnly?: boolean
}

function previewAmounts(splits: CommissionSplitRow[], parentAmount: string | null | undefined): CommissionSplitRow[] {
  if (!parentAmount || !splits.length) return splits
  try {
    const points = splits.map((split) => toPointsUnits(split.points || '0'))
    if (points.every((part) => part === 0)) {
      return splits.map((split) => ({ ...split, amount: '0.00' }))
    }
    const amounts = splitCommissionAmounts(parentAmount, points)
    return splits.map((split, index) => ({ ...split, amount: amounts[index] ?? split.amount ?? null }))
  } catch {
    return splits
  }
}

export function CommissionSplits({
  splits,
  parentPoints,
  parentAmount,
  onChange,
  readOnly = false,
}: CommissionSplitsProps) {
  const t = useT()
  const canEdit = Boolean(onChange) && !readOnly
  const rows = React.useMemo(() => previewAmounts(splits, parentAmount), [splits, parentAmount])
  const pointsMatch = splitPointsMatchParent(parentPoints || '0', rows.length ? rows : [{ points: parentPoints || '0' }])

  const updateRow = (index: number, patch: Partial<CommissionSplitRow>) => {
    if (!onChange) return
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{t('merchant_advances.funding.splits.title')}</h3>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([
              ...rows,
              { userId: null, role: null, points: '0', amount: null },
            ])}
          >
            <Plus />
            {t('merchant_advances.funding.splits.add')}
          </Button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('merchant_advances.funding.splits.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t('merchant_advances.funding.splits.role')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('merchant_advances.funding.splits.user')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('merchant_advances.funding.splits.points')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('merchant_advances.funding.splits.amount')}</th>
                {canEdit ? <th className="px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.userId ?? 'split'}-${index}`} className="border-t border-border">
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <Input
                        value={row.role ?? ''}
                        onChange={(event) => updateRow(index, { role: event.target.value || null })}
                        placeholder={t('merchant_advances.funding.splits.ownerRole')}
                      />
                    ) : (
                      row.role === MCA_DEFAULT_OWNER_SPLIT_ROLE
                        ? t('merchant_advances.funding.splits.ownerRole')
                        : (row.role ?? '—')
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <Input
                        value={row.userId ?? ''}
                        onChange={(event) => updateRow(index, { userId: event.target.value || null })}
                        placeholder={t('merchant_advances.funding.splits.user')}
                      />
                    ) : (
                      row.userId ?? '—'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <Input
                        value={row.points}
                        onChange={(event) => updateRow(index, { points: event.target.value })}
                        inputMode="decimal"
                      />
                    ) : (
                      row.points
                    )}
                  </td>
                  <td className="px-3 py-2">{row.amount ?? '—'}</td>
                  {canEdit ? (
                    <td className="px-3 py-2 text-right">
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={t('merchant_advances.funding.splits.remove')}
                        onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                      >
                        <Trash2 />
                      </IconButton>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {t('merchant_advances.funding.splits.totalPoints')}: {parentPoints || '0'}
        {rows.length && !pointsMatch ? ` — ${t('merchant_advances.funding.splits.pointsMismatch')}` : ''}
      </p>
    </div>
  )
}
