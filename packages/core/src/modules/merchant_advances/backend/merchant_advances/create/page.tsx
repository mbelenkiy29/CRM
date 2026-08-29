"use client"

import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function toOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export default function CreateMcaDealPage() {
  const t = useT()
  const router = useRouter()

  const fields: CrudField[] = [
    { id: 'businessName', label: t('merchant_advances.deals.fields.businessName'), type: 'text', required: true },
    { id: 'requestedAmount', label: t('merchant_advances.deals.fields.requestedAmount'), type: 'text' },
    { id: 'avgMonthlyRevenue', label: t('merchant_advances.deals.fields.avgMonthlyRevenue'), type: 'text' },
    { id: 'timeInBusinessMonths', label: t('merchant_advances.deals.fields.timeInBusinessMonths'), type: 'number' },
    { id: 'position', label: t('merchant_advances.deals.fields.position'), type: 'number' },
    { id: 'industry', label: t('merchant_advances.deals.fields.industry'), type: 'text' },
    { id: 'state', label: t('merchant_advances.deals.fields.state'), type: 'text' },
  ]

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('merchant_advances.create.title')}
          fields={fields}
          submitLabel={t('merchant_advances.deals.create')}
          cancelHref="/backend/merchant_advances"
          onSubmit={async (values) => {
            const created = await createCrud<Record<string, unknown>>('merchant_advances/deals', {
              businessName: String(values.businessName ?? '').trim(),
              requestedAmount: toOptionalText(values.requestedAmount),
              avgMonthlyRevenue: toOptionalText(values.avgMonthlyRevenue),
              timeInBusinessMonths: toOptionalNumber(values.timeInBusinessMonths),
              position: toOptionalNumber(values.position),
              industry: toOptionalText(values.industry),
              state: toOptionalText(values.state),
            })
            const newId = created.result && typeof created.result.id === 'string' ? created.result.id : null
            router.push(newId ? `/backend/merchant_advances/${newId}` : '/backend/merchant_advances')
          }}
        />
      </PageBody>
    </Page>
  )
}
