"use client"

import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { Card, CardDescription, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { useT } from '@open-mercato/shared/lib/i18n/context'

const REPORT_KEYS = ['rep', 'team', 'funder', 'leads'] as const

export default function MerchantAdvancesReportsPage() {
  const t = useT()
  return (
    <Page>
      <PageHeader
        title={t('merchant_advances.reports.title')}
        description={t('merchant_advances.reports.restricted')}
      />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-2">
          {REPORT_KEYS.map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{t(`merchant_advances.reports.${key}`)}</CardTitle>
                <CardDescription>{t('merchant_advances.reports.comingSoon')}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </PageBody>
    </Page>
  )
}
