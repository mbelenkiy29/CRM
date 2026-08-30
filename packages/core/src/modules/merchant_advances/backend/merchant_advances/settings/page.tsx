"use client"

import * as React from 'react'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField } from '@open-mercato/ui/backend/CrudForm'
import { ContextHelp } from '@open-mercato/ui/backend/ContextHelp'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
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

type SettingsValues = {
  defaultFromAddress: string
  watermarkEnabled: boolean
  uploadLinksEnabled: boolean
  uploadLinkTtlHours: number
  intakeWebhookSecret: string
  intakeWebhookSecretConfigured: boolean
  updatedAt: string | null
}

function toSettingsValues(raw: Record<string, unknown>): SettingsValues {
  return {
    defaultFromAddress: typeof raw.defaultFromAddress === 'string' ? raw.defaultFromAddress : '',
    watermarkEnabled: raw.watermarkEnabled !== false,
    uploadLinksEnabled: raw.uploadLinksEnabled !== false,
    uploadLinkTtlHours: typeof raw.uploadLinkTtlHours === 'number' ? raw.uploadLinkTtlHours : 72,
    intakeWebhookSecret: '',
    intakeWebhookSecretConfigured: raw.intakeWebhookSecretConfigured === true,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  }
}

export default function MerchantAdvancesSettingsPage() {
  const t = useT()
  const { runMutation } = useGuardedMutation({ contextId: 'merchant_advances.settings.intake' })
  const [values, setValues] = React.useState<SettingsValues | null>(null)
  const [addresses, setAddresses] = React.useState<IntakeAddress[]>([])
  const [emailAddress, setEmailAddress] = React.useState('')
  const [addressesLoading, setAddressesLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setError(null)
    try {
      const result = await readApiResultOrThrow<Record<string, unknown>>(
        '/api/merchant_advances/settings',
        undefined,
        { errorMessage: t('merchant_advances.errors.settingsLoadFailed') },
      )
      setValues(toSettingsValues(result))
    } catch {
      setError(t('merchant_advances.errors.settingsLoadFailed'))
    }
  }, [t])

  const loadAddresses = React.useCallback(async () => {
    const result = await readApiResultOrThrow<{ items?: IntakeAddress[] }>(
      '/api/merchant_advances/intake-addresses',
    )
    setAddresses(result.items ?? [])
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadAddresses()
      } catch {
        if (!cancelled) setError(t('merchant_advances.errors.loadFailed'))
      } finally {
        if (!cancelled) setAddressesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadAddresses, t])

  const fields: CrudField[] = [
    {
      id: 'defaultFromAddress',
      label: t('merchant_advances.settings.fields.defaultFromAddress'),
      type: 'text',
      description: t('merchant_advances.settings.fields.defaultFromAddressHelp'),
    },
    {
      id: 'watermarkEnabled',
      label: t('merchant_advances.settings.fields.watermarkEnabled'),
      type: 'checkbox',
    },
    {
      id: 'uploadLinksEnabled',
      label: t('merchant_advances.settings.fields.uploadLinksEnabled'),
      type: 'checkbox',
      description: t('merchant_advances.settings.fields.uploadLinksEnabledHelp'),
    },
    {
      id: 'uploadLinkTtlHours',
      label: t('merchant_advances.settings.fields.uploadLinkTtlHours'),
      type: 'number',
    },
    {
      id: 'intakeWebhookSecret',
      label: t('merchant_advances.settings.fields.intakeWebhookSecret'),
      type: 'password',
      description: values?.intakeWebhookSecretConfigured
        ? t('merchant_advances.settings.fields.intakeWebhookSecretConfigured')
        : t('merchant_advances.settings.fields.intakeWebhookSecretHelp'),
    },
  ]

  return (
    <Page>
      <PageHeader
        title={t('merchant_advances.settings.title')}
        description={t('merchant_advances.settings.description')}
      />
      <PageBody>
        <ContextHelp title={t('merchant_advances.settings.intakeHelpTitle')}>
          {t('merchant_advances.settings.intakeHelpBody')}
        </ContextHelp>
        {error ? <ErrorMessage label={error} /> : null}
        {!values && !error ? <LoadingMessage label={t('merchant_advances.common.loading')} /> : null}
        {values ? (
          <CrudForm
            title={t('merchant_advances.settings.formTitle')}
            fields={fields}
            initialValues={values}
            submitLabel={t('merchant_advances.settings.save')}
            cancelHref="/backend/merchant_advances"
            onSubmit={async (submitted) => {
              const payload: Record<string, unknown> = {
                defaultFromAddress: String(submitted.defaultFromAddress ?? '').trim() || null,
                watermarkEnabled: Boolean(submitted.watermarkEnabled),
                uploadLinksEnabled: Boolean(submitted.uploadLinksEnabled),
                uploadLinkTtlHours: Number(submitted.uploadLinkTtlHours ?? 72),
              }
              const secret = String(submitted.intakeWebhookSecret ?? '').trim()
              if (secret) payload.intakeWebhookSecret = secret
              await updateCrud('merchant_advances/settings', payload)
              flash(t('merchant_advances.settings.saved'), 'success')
              await load()
            }}
          />
        ) : null}
        <div className="mt-8 flex max-w-xl flex-col gap-4">
          <div>
            <h2 className="text-sm font-medium">{t('merchant_advances.settings.intake.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('merchant_advances.settings.intake.description')}</p>
          </div>
          {addressesLoading ? <LoadingMessage label={t('merchant_advances.common.loading')} /> : null}
          {!addressesLoading && addresses.length === 0 ? (
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
                  } catch {
                    setError(t('merchant_advances.errors.saveFailed'))
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
