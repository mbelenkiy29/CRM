"use client"

import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@open-mercato/ui/primitives/alert'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type StatusResult = {
  showSetupBanner?: boolean
}

export function SetupBanner() {
  const t = useT()
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const body = await readApiResultOrThrow<{ result?: StatusResult } & StatusResult>('/api/merchant_advances/onboarding/status')
        const result = body.result ?? body
        if (!cancelled) setVisible(result.showSetupBanner === true)
      } catch {
        if (!cancelled) setVisible(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!visible) return null
  return (
    <Alert status="warning" style="lighter" className="mb-4">
      <AlertTitle>{t('merchant_advances.onboarding.banner.title')}</AlertTitle>
      <AlertDescription>{t('merchant_advances.onboarding.banner.body')}</AlertDescription>
    </Alert>
  )
}
