"use client"

import * as React from 'react'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { apiCall, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type IntakeAddress = {
  id: string
  emailAddress: string
  isActive: boolean
}

export default function MerchantAdvancesSettingsPage() {
  const t = useT()
  const { runMutation } = useGuardedMutation({ contextId: 'merchant_advances.settings.intake' })
  const [addresses, setAddresses] = React.useState<IntakeAddress[]>([])
  const [emailAddress, setEmailAddress] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadAddresses = React.useCallback(async () => {
    const result = await readApiResultOrThrow<{ items?: IntakeAddress[] }>(
      '/api/merchant_advances/intake-addresses',
    )
    setAddresses(result.items ?? [])
  }, [])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadAddresses()
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('merchant_advances.errors.loadFailed'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadAddresses, t])

  return (
    <Page>
      <PageHeader
        title={t('merchant_advances.settings.title')}
        description={t('merchant_advances.settings.description')}
      />
      <PageBody>
        <div className="flex max-w-xl flex-col gap-4">
          <div>
            <h2 className="text-sm font-medium">{t('merchant_advances.settings.intake.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('merchant_advances.settings.intake.description')}</p>
          </div>
          {loading ? <LoadingMessage label={t('merchant_advances.common.loading')} /> : null}
          {error ? <ErrorMessage label={error} /> : null}
          {!loading && addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('merchant_advances.settings.intake.empty')}</p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {addresses.map((address) => (
              <li key={address.id} className="text-sm">{address.emailAddress}</li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mca-intake-email">{t('merchant_advances.settings.intake.email')}</Label>
            <Input
              id="mca-intake-email"
              type="email"
              value={emailAddress}
              onChange={(event) => setEmailAddress(event.target.value)}
            />
            <Button
              type="button"
              disabled={!emailAddress.trim()}
              onClick={() => {
                void (async () => {
                  setError(null)
                  try {
                    const call = await runMutation({
                      operation: () => apiCall('/api/merchant_advances/intake-addresses', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ emailAddress: emailAddress.trim() }),
                      }),
                      context: { formId: 'merchant_advances.settings.intake' },
                      mutationPayload: { emailAddress },
                    })
                    if (!call.ok) {
                      setError(t('merchant_advances.errors.saveFailed'))
                      return
                    }
                    setEmailAddress('')
                    await loadAddresses()
                    flash(t('merchant_advances.settings.intake.saved'), 'success')
                  } catch (saveError) {
                    setError(saveError instanceof Error ? saveError.message : t('merchant_advances.errors.saveFailed'))
                  }
                })()
              }}
            >
              {t('merchant_advances.settings.intake.add')}
            </Button>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
