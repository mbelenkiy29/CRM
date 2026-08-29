"use client"

import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function MerchantAdvancesSettingsPage() {
  const t = useT()
  return (
    <Page>
      <PageHeader
        title={t('merchant_advances.settings.title')}
        description={t('merchant_advances.settings.description')}
      />
      <PageBody>
        <p className="text-sm text-muted-foreground">{t('merchant_advances.settings.comingSoon')}</p>
      </PageBody>
    </Page>
  )
}
