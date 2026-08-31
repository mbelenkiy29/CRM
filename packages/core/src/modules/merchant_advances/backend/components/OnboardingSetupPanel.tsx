"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { McaOnboardingStatusChips } from '../../lib/onboarding/types'

type OnboardingLoad = {
  chips?: McaOnboardingStatusChips
  onboarding?: { completedAt?: string | null }
}

function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'result' in body) {
    const inner = (body as { result?: unknown }).result
    if (inner && typeof inner === 'object') return inner as T
  }
  return body as T
}

export function OnboardingSetupPanel() {
  const t = useT()
  const router = useRouter()
  const [chips, setChips] = React.useState<McaOnboardingStatusChips | null>(null)
  const { runMutation, retryLastMutation } = useGuardedMutation({
    contextId: 'merchant-advances-setup',
    blockedMessage: t('merchant_advances.errors.saveBlocked'),
  })

  const load = React.useCallback(async () => {
    const body = await readApiResultOrThrow<unknown>('/api/merchant_advances/onboarding')
    const result = unwrap<OnboardingLoad>(body)
    setChips(result.chips ?? null)
  }, [])

  React.useEffect(() => {
    void load().catch(() => undefined)
  }, [load])

  return (
    <section className="mt-8 grid gap-4 rounded-md border border-border p-4" data-tour-id="setup-replay">
      <div>
        <h2 className="text-base font-medium">{t('merchant_advances.settings.setup.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('merchant_advances.settings.setup.description')}</p>
      </div>
      {chips ? (
        <div className="flex flex-wrap gap-2">
          <StatusBadge variant={chips.intakeConnected ? 'success' : 'neutral'}>
            {chips.intakeConnected
              ? t('merchant_advances.settings.setup.chips.intakeOn')
              : t('merchant_advances.settings.setup.chips.intakeOff')}
          </StatusBadge>
          <StatusBadge variant={chips.funderCount > 0 ? 'success' : 'neutral'}>
            {t('merchant_advances.settings.setup.chips.funders', { count: String(chips.funderCount) })}
          </StatusBadge>
          <StatusBadge variant={chips.senderCount > 0 ? 'success' : 'neutral'}>
            {t('merchant_advances.settings.setup.chips.senders', { count: String(chips.senderCount) })}
          </StatusBadge>
          <StatusBadge variant={chips.extrasOn ? 'success' : 'neutral'}>
            {chips.extrasOn
              ? t('merchant_advances.settings.setup.chips.extrasOn')
              : t('merchant_advances.settings.setup.chips.extrasOff')}
          </StatusBadge>
          <StatusBadge variant={chips.completed ? 'success' : 'warning'}>
            {chips.completed
              ? t('merchant_advances.settings.setup.chips.complete')
              : t('merchant_advances.settings.setup.chips.incomplete')}
          </StatusBadge>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => router.push('/backend/merchant_advances/onboarding')}>
          {t('merchant_advances.settings.setup.openWizard')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            await runMutation({
              operation: () => readApiResultOrThrow('/api/merchant_advances/onboarding', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ restart: true, step: 'welcome' }),
              }),
              context: { formId: 'merchant-advances-setup', resourceKind: 'merchant_advances.onboarding', retryLastMutation },
              mutationPayload: { restart: true },
            })
            flash(t('merchant_advances.settings.setup.restarted'), 'success')
            router.push('/backend/merchant_advances/onboarding')
          }}
        >
          {t('merchant_advances.settings.setup.restart')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            const body = await runMutation({
              operation: () => readApiResultOrThrow<{ result?: { secret: string }; secret?: string }>('/api/merchant_advances/onboarding/rotate-secret', { method: 'POST' }),
              context: { formId: 'merchant-advances-setup', resourceKind: 'merchant_advances.onboarding', retryLastMutation },
              mutationPayload: { rotate: true },
            })
            const secret = body.result?.secret ?? body.secret
            if (secret) flash(t('merchant_advances.settings.setup.secretRotated'), 'success')
            await load()
          }}
        >
          {t('merchant_advances.settings.setup.rotateSecret')}
        </Button>
        <Button asChild variant="outline">
          <Link href="/backend/merchant_advances/funders">{t('merchant_advances.settings.setup.editFunders')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/backend/merchant_advances/onboarding">{t('merchant_advances.settings.setup.editSenders')}</Link>
        </Button>
      </div>
    </section>
  )
}
