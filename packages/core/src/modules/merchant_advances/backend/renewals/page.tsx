"use client"

import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function MerchantAdvancesRenewalsPage() {
  const t = useT()
  return (
    <Page>
      <PageHeader title={t('merchant_advances.renewals.title')} />
      <PageBody>
        <ListEmptyState
          title={t('merchant_advances.renewals.empty.title')}
          description={t('merchant_advances.renewals.empty.description')}
        />
      </PageBody>
    </Page>
  )
}
