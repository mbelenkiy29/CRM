"use client"

import * as React from 'react'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField } from '@open-mercato/ui/backend/CrudForm'
import { ContextHelp } from '@open-mercato/ui/backend/ContextHelp'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { OnboardingSetupPanel } from '../../components/OnboardingSetupPanel'
import { McaPageChrome } from '../../components/McaPageChrome'

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
  const [values, setValues] = React.useState<SettingsValues | null>(null)
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

  React.useEffect(() => {
    void load()
  }, [load])

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
        <McaPageChrome />
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
        {values ? <OnboardingSetupPanel /> : null}
      </PageBody>
    </Page>
  )
}
