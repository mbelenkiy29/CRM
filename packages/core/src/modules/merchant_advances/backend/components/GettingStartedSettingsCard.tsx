"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export function GettingStartedSettingsCard() {
  const t = useT()
  const router = useRouter()

  return (
    <section className="mb-8 grid gap-3 rounded-md border border-border p-4">
      <div>
        <h2 className="text-base font-medium">{t('merchant_advances.tour.settings.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('merchant_advances.tour.settings.description')}</p>
      </div>
      <div>
        <Button
          type="button"
          onClick={() => {
            flash(t('merchant_advances.tour.replayFlash'), 'success')
            router.push('/backend/merchant_advances?tour=getting-started')
          }}
        >
          {t('merchant_advances.tour.replay')}
        </Button>
      </div>
    </section>
  )
}
