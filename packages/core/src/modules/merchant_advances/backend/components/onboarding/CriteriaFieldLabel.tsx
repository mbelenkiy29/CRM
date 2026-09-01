"use client"

import { Info } from 'lucide-react'
import { Label } from '@open-mercato/ui/primitives/label'
import { SimpleTooltip } from '@open-mercato/ui/primitives/tooltip'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export const CRITERIA_GLOSSARY: Record<string, 'amr' | 'tib' | 'nsf' | 'adb' | 'sic'> = {
  minAvgMonthlyRevenue: 'amr',
  maxAvgMonthlyRevenue: 'amr',
  minTimeInBusinessMonths: 'tib',
  maxNsfCount: 'nsf',
  minAvgDailyBalance: 'adb',
  excludedSic: 'sic',
}

type GlossaryHintProps = {
  term: 'amr' | 'tib' | 'nsf' | 'adb' | 'sic'
}

export function GlossaryHint({ term }: GlossaryHintProps) {
  const t = useT()
  return (
    <SimpleTooltip content={t(`merchant_advances.glossary.${term}`)}>
      <span
        tabIndex={0}
        className="inline-flex text-muted-foreground"
        aria-label={t(`merchant_advances.glossary.${term}Aria`)}
      >
        <Info className="size-4" />
      </span>
    </SimpleTooltip>
  )
}

type CriteriaFieldLabelProps = {
  htmlFor?: string
  criteriaKey: string
}

export function CriteriaFieldLabel({ htmlFor, criteriaKey }: CriteriaFieldLabelProps) {
  const t = useT()
  const term = CRITERIA_GLOSSARY[criteriaKey]
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor}>{t(`merchant_advances.onboarding.criteria.${criteriaKey}`)}</Label>
      {term ? <GlossaryHint term={term} /> : null}
    </div>
  )
}
