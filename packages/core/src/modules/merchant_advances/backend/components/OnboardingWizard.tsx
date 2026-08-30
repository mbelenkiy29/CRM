"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { Alert, AlertDescription, AlertTitle } from '@open-mercato/ui/primitives/alert'
import { Button } from '@open-mercato/ui/primitives/button'
import { CheckboxField } from '@open-mercato/ui/primitives/checkbox-field'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { RadioField } from '@open-mercato/ui/primitives/radio-field'
import { RadioGroup } from '@open-mercato/ui/primitives/radio'
import { StepIndicator, type StepIndicatorStep } from '@open-mercato/ui/primitives/step-indicator'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { FUNDER_CRITERIA_KEYS } from '../../lib/funderScore'
import {
  MCA_ONBOARDING_INTAKE_SOURCES,
  MCA_ONBOARDING_STEPS,
  type McaOnboardingIntakeSource,
  type McaOnboardingSeat,
  type McaOnboardingState,
  type McaOnboardingStatusChips,
  type McaOnboardingStep,
} from '../../lib/onboarding/types'
import { resumeOnboardingStep } from '../../lib/onboarding/state'

type OnboardingLoad = {
  onboarding: McaOnboardingState
  plan?: string
  trialEndsAt?: string | null
  intakeWebhookSecretConfigured?: boolean
  webhooksEnabled?: boolean
  webhookUrl?: string
  samplePayload?: Record<string, unknown>
  chips?: McaOnboardingStatusChips
}

type AuthUser = { id: string; email?: string; name?: string }
type FunderRow = {
  id: string
  name: string | null
  code?: string | null
  submitMethod?: string | null
  submitEmail?: string | null
  requiresUnstampedStatements?: boolean
  criteria?: Record<string, unknown> | null
}
type MatchRow = { funderId: string | null; score?: string | null }

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'UTC',
]

const CRITERIA_BOOL = new Set(['allowStacking', 'weekendDepositsOk', 'bankruptcyOk'])
const CRITERIA_LIST = new Set([
  'industries',
  'excludedIndustries',
  'states',
  'preferredIndustries',
  'entityTypes',
  'excludedSic',
  'useOfFunds',
])

function unwrapApi<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'result' in body) {
    const inner = (body as { result?: unknown }).result
    if (inner && typeof inner === 'object') return inner as T
  }
  return body as T
}

async function readPayload<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const body = await readApiResultOrThrow<unknown>(input, init)
  return unwrapApi<T>(body)
}

function nextStepOf(step: McaOnboardingStep): McaOnboardingStep {
  const index = MCA_ONBOARDING_STEPS.indexOf(step)
  return MCA_ONBOARDING_STEPS[Math.min(index + 1, MCA_ONBOARDING_STEPS.length - 1)] ?? 'first_deal'
}

function prevStepOf(step: McaOnboardingStep): McaOnboardingStep {
  const index = MCA_ONBOARDING_STEPS.indexOf(step)
  return MCA_ONBOARDING_STEPS[Math.max(index - 1, 0)] ?? 'welcome'
}

function preventWizardFormSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
}

export function OnboardingWizard() {
  const t = useT()
  const router = useRouter()
  const [state, setState] = React.useState<McaOnboardingState | null>(null)
  const [load, setLoad] = React.useState<OnboardingLoad | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [secretOnce, setSecretOnce] = React.useState<string | null>(null)
  const [users, setUsers] = React.useState<AuthUser[]>([])
  const [funders, setFunders] = React.useState<FunderRow[]>([])
  const [matches, setMatches] = React.useState<MatchRow[]>([])
  const [csvText, setCsvText] = React.useState('')
  const [csvPreview, setCsvPreview] = React.useState<string | null>(null)
  const [uploadLink, setUploadLink] = React.useState<string | null>(null)
  const [uploadExpiresAt, setUploadExpiresAt] = React.useState<string | null>(null)
  const [showSamplePayload, setShowSamplePayload] = React.useState(false)
  const [smsKey, setSmsKey] = React.useState('')
  const [esignKey, setEsignKey] = React.useState('')
  const [newFunder, setNewFunder] = React.useState({
    name: '',
    code: '',
    route: 'email',
    submitEmail: '',
    fromAddressOverride: '',
    requiresUnstampedStatements: false,
    criteria: {} as Record<string, unknown>,
  })
  const [skipWarning, setSkipWarning] = React.useState(false)

  const { runMutation, retryLastMutation } = useGuardedMutation({
    contextId: 'merchant-advances-onboarding',
    blockedMessage: t('merchant_advances.errors.saveBlocked'),
  })

  const refreshFunders = React.useCallback(async () => {
    const result = await readPayload<{ items?: FunderRow[] }>('/api/merchant_advances/funders?page=1&pageSize=50&sortField=name&sortDir=asc')
    setFunders(result.items ?? [])
  }, [])

  const applyLoad = React.useCallback((result: OnboardingLoad) => {
    setLoad(result)
    setState(result.onboarding)
  }, [])

  const bootstrap = React.useCallback(async () => {
    setError(null)
    try {
      const result = await readPayload<OnboardingLoad>('/api/merchant_advances/onboarding')
      applyLoad(result)
      const usersResult = await readPayload<{ items?: AuthUser[] }>('/api/auth/users?page=1&pageSize=50')
      setUsers(usersResult.items ?? [])
      await refreshFunders()
    } catch {
      setError(t('merchant_advances.errors.onboardingLoadFailed'))
    }
  }, [applyLoad, refreshFunders, t])

  React.useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const mutate = React.useCallback(async <T,>(operation: () => Promise<T>, payload: Record<string, unknown>) => {
    return runMutation({
      operation,
      context: {
        formId: 'merchant-advances-onboarding',
        resourceKind: 'merchant_advances.onboarding',
        retryLastMutation,
      },
      mutationPayload: payload,
    })
  }, [retryLastMutation, runMutation])

  const save = React.useCallback(async (patch: Record<string, unknown>, messageKey?: string) => {
    if (!state) return null
    const result = await mutate(
      () => readPayload<OnboardingLoad>('/api/merchant_advances/onboarding', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }),
      patch,
    )
    applyLoad(result)
    if (messageKey) flash(t(messageKey), 'success')
    return result
  }, [applyLoad, mutate, state, t])

  if (error) {
    return (
      <Page>
        <PageHeader title={t('merchant_advances.onboarding.title')} />
        <PageBody><ErrorMessage label={error} /></PageBody>
      </Page>
    )
  }
  if (!state || !load) {
    return (
      <Page>
        <PageHeader title={t('merchant_advances.onboarding.title')} />
        <PageBody><LoadingMessage label={t('merchant_advances.common.loading')} /></PageBody>
      </Page>
    )
  }

  const step = resumeOnboardingStep(state)
  const stepIndex = MCA_ONBOARDING_STEPS.indexOf(step)
  const indicatorSteps: StepIndicatorStep[] = MCA_ONBOARDING_STEPS.map((id, index) => ({
    id,
    label: t(`merchant_advances.onboarding.steps.${id}`),
    status: index < stepIndex ? 'complete' : index === stepIndex ? 'current' : 'pending',
  }))

  const go = async (next: McaOnboardingStep, extra: Record<string, unknown> = {}) => {
    await save({ ...extra, step: next })
  }

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value)
    flash(t('merchant_advances.onboarding.copied'), 'success')
  }

  return (
    <Page className="flex max-h-[calc(100svh-6rem)] flex-col gap-6 space-y-0 overflow-hidden">
      <PageHeader
        title={t('merchant_advances.onboarding.title')}
        description={t('merchant_advances.onboarding.subtitle')}
      />
      <PageBody className="flex min-h-0 flex-1 flex-col gap-4 space-y-0 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mb-6">
          <StepIndicator steps={indicatorSteps} onStepClick={(id) => { void go(id as McaOnboardingStep) }} />
        </div>

        {step === 'welcome' ? (
          <section className="flex flex-col gap-4">
            <Alert status="feature" style="lighter">
              <AlertTitle>{t('merchant_advances.onboarding.welcome.headline')}</AlertTitle>
              <AlertDescription>{t('merchant_advances.onboarding.welcome.noCall')}</AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">{t('merchant_advances.onboarding.welcome.body')}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>{t('merchant_advances.onboarding.welcome.outcome.intake')}</li>
              <li>{t('merchant_advances.onboarding.welcome.outcome.coverage')}</li>
              <li>{t('merchant_advances.onboarding.welcome.outcome.replies')}</li>
              <li>{t('merchant_advances.onboarding.welcome.outcome.renewals')}</li>
            </ul>
            <Alert status="information" style="lighter">
              <AlertDescription>{t('merchant_advances.onboarding.welcome.funders')}</AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void go('shop')}>{t('merchant_advances.onboarding.welcome.start')}</Button>
            </div>
          </section>
        ) : null}

        {step === 'shop' ? (
          <form className="grid max-w-xl gap-4" onSubmit={preventWizardFormSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="legalName">{t('merchant_advances.onboarding.shop.legalName')}</Label>
              <Input id="legalName" value={state.shop.legalName ?? ''} onChange={(event) => setState({ ...state, shop: { ...state.shop, legalName: event.target.value } })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dbaName">{t('merchant_advances.onboarding.shop.dbaName')}</Label>
              <Input id="dbaName" value={state.shop.dbaName ?? ''} onChange={(event) => setState({ ...state, shop: { ...state.shop, dbaName: event.target.value } })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="primaryState">{t('merchant_advances.onboarding.shop.primaryState')}</Label>
              <Input id="primaryState" maxLength={2} value={state.shop.primaryState ?? ''} onChange={(event) => setState({ ...state, shop: { ...state.shop, primaryState: event.target.value.toUpperCase() } })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timezone">{t('merchant_advances.onboarding.shop.timezone')}</Label>
              <select
                id="timezone"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={state.shop.timezone ?? ''}
                onChange={(event) => setState({ ...state, shop: { ...state.shop, timezone: event.target.value } })}
              >
                <option value="">{t('merchant_advances.onboarding.shop.timezonePlaceholder')}</option>
                {TIMEZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>{t('merchant_advances.onboarding.shop.currency')}</Label>
              <Input value="USD" readOnly />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logo">{t('merchant_advances.onboarding.shop.logo')}</Label>
              <Input id="logo" value={state.shop.brokerLogoAttachmentId ?? ''} onChange={(event) => setState({ ...state, shop: { ...state.shop, brokerLogoAttachmentId: event.target.value || null } })} />
              <p className="text-xs text-muted-foreground">{t('merchant_advances.onboarding.shop.logoHelp')}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="from">{t('merchant_advances.onboarding.shop.fromAddress')}</Label>
              <Input id="from" type="email" value={state.shop.defaultFromAddress ?? ''} onChange={(event) => setState({ ...state, shop: { ...state.shop, defaultFromAddress: event.target.value } })} />
            </div>
          </form>
        ) : null}

        {step === 'intake' ? (
          <form className="grid max-w-2xl gap-4" onSubmit={preventWizardFormSubmit}>
            <RadioGroup
              value={state.intake.source ?? ''}
              onValueChange={(value) => setState({ ...state, intake: { ...state.intake, source: value as McaOnboardingIntakeSource } })}
            >
              {MCA_ONBOARDING_INTAKE_SOURCES.map((source) => (
                <RadioField key={source} value={source} label={t(`merchant_advances.onboarding.intake.source.${source}`)} />
              ))}
            </RadioGroup>
            {state.intake.source && !['spreadsheet', 'unsure'].includes(state.intake.source) ? (
              <div className="grid gap-3 rounded-md border border-border p-4">
                {!load.webhooksEnabled ? (
                  <Alert status="warning" style="lighter">
                    <AlertDescription>{t('merchant_advances.onboarding.intake.webhooksOff')}</AlertDescription>
                  </Alert>
                ) : null}
                <p className="text-sm">{t('merchant_advances.onboarding.intake.webhookUrl')}</p>
                <div className="flex flex-wrap gap-2">
                  <Input readOnly value={load.webhookUrl ?? ''} />
                  <Button type="button" variant="secondary" onClick={() => void copyText(load.webhookUrl ?? '')}>{t('merchant_advances.onboarding.copy')}</Button>
                </div>
                {secretOnce ? (
                  <Alert status="warning" style="lighter">
                    <AlertTitle>{t('merchant_advances.onboarding.intake.secretOnce')}</AlertTitle>
                    <AlertDescription>
                      <code className="break-all">{secretOnce}</code>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {load.intakeWebhookSecretConfigured
                      ? t('merchant_advances.onboarding.intake.secretConfigured')
                      : t('merchant_advances.onboarding.intake.secretHelp')}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      const result = await mutate(
                        () => readPayload<{ secret: string }>('/api/merchant_advances/onboarding/rotate-secret', { method: 'POST' }),
                        { rotate: true },
                      )
                      setSecretOnce(result.secret)
                      flash(t('merchant_advances.onboarding.intake.secretIssued'), 'success')
                    }}
                  >
                    {t('merchant_advances.onboarding.intake.issueSecret')}
                  </Button>
                  {secretOnce ? (
                    <Button type="button" variant="secondary" onClick={() => void copyText(secretOnce)}>{t('merchant_advances.onboarding.copy')}</Button>
                  ) : null}
                </div>
                <RadioGroup
                  value={state.intake.assignment}
                  onValueChange={(value) => setState({ ...state, intake: { ...state.intake, assignment: value as 'form_owner' | 'round_robin' } })}
                >
                  <RadioField value="form_owner" label={t('merchant_advances.onboarding.intake.assignment.form_owner')} />
                  <RadioField value="round_robin" label={t('merchant_advances.onboarding.intake.assignment.round_robin')} />
                </RadioGroup>
                {state.intake.assignment === 'round_robin' ? (
                  <div className="grid gap-2">
                    {users.map((user) => (
                      <CheckboxField
                        key={user.id}
                        label={user.email ?? user.id}
                        checked={state.intake.assigneeUserIds.includes(user.id)}
                        onCheckedChange={(checked) => {
                          const ids = checked
                            ? [...state.intake.assigneeUserIds, user.id]
                            : state.intake.assigneeUserIds.filter((id) => id !== user.id)
                          setState({ ...state, intake: { ...state.intake, assigneeUserIds: ids } })
                        }}
                      />
                    ))}
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowSamplePayload((open) => !open)}
                >
                  {t(showSamplePayload
                    ? 'merchant_advances.onboarding.intake.hideSample'
                    : 'merchant_advances.onboarding.intake.showSample')}
                </Button>
                {showSamplePayload ? (
                  <div className="grid gap-2">
                    <Label>{t('merchant_advances.onboarding.intake.sample')}</Label>
                    <Textarea readOnly rows={8} value={JSON.stringify(load.samplePayload ?? {}, null, 2)} />
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    const result = await mutate(
                      () => readPayload<{ dealId: string; fetchedUrls: boolean }>('/api/merchant_advances/onboarding/test-intake', { method: 'POST' }),
                      { fixture: 'sunset-diner' },
                    )
                    flash(t('merchant_advances.onboarding.intake.tested'), 'success')
                    setState({
                      ...state,
                      intake: { ...state.intake, testedDealId: result.dealId, secretIssued: true },
                      firstDealId: state.firstDealId ?? result.dealId,
                    })
                  }}
                >
                  {t('merchant_advances.onboarding.intake.test')}
                </Button>
              </div>
            ) : null}
            {state.intake.source === 'spreadsheet' ? (
              <Alert status="information" style="lighter">
                <AlertDescription>
                  <Link className="underline" href="/backend/merchant_advances/imports">{t('merchant_advances.onboarding.intake.importLink')}</Link>
                </AlertDescription>
              </Alert>
            ) : null}
          </form>
        ) : null}

        {step === 'people' ? (
          <section className="grid max-w-2xl gap-4">
            <p className="text-sm text-muted-foreground">{t('merchant_advances.onboarding.people.help')}</p>
            {users.map((user) => {
              const seat = state.seats.find((row) => row.userId === user.id)
              return (
                <div key={user.id} className="grid gap-2 rounded-md border border-border p-3">
                  <CheckboxField
                    label={user.email ?? user.id}
                    checked={Boolean(seat)}
                    onCheckedChange={(checked) => {
                      const seats = checked
                        ? [...state.seats, { userId: user.id, email: user.email ?? null, name: user.name ?? null, floor: 'rep' as const, fromAddress: null }]
                        : state.seats.filter((row) => row.userId !== user.id)
                      setState({ ...state, seats })
                    }}
                  />
                  {seat ? (
                    <>
                      <RadioGroup
                        value={seat.floor}
                        onValueChange={(value) => {
                          setState({
                            ...state,
                            seats: state.seats.map((row) => row.userId === user.id ? { ...row, floor: value === 'admin' ? 'admin' : 'rep' } : row),
                          })
                        }}
                      >
                        <RadioField value="admin" label={t('merchant_advances.onboarding.people.admin')} />
                        <RadioField value="rep" label={t('merchant_advances.onboarding.people.rep')} />
                      </RadioGroup>
                      <Input
                        type="email"
                        placeholder={t('merchant_advances.onboarding.people.fromAddress')}
                        value={seat.fromAddress ?? ''}
                        onChange={(event) => {
                          setState({
                            ...state,
                            seats: state.seats.map((row) => row.userId === user.id ? { ...row, fromAddress: event.target.value || null } : row),
                          })
                        }}
                      />
                    </>
                  ) : null}
                </div>
              )
            })}
            <div className="grid gap-2">
              <Label>{t('merchant_advances.onboarding.people.originator')}</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={state.defaultOriginatorUserId ?? ''}
                onChange={(event) => setState({ ...state, defaultOriginatorUserId: event.target.value || null })}
              >
                <option value="">{t('merchant_advances.onboarding.people.originatorNone')}</option>
                {state.seats.map((seat) => (
                  <option key={seat.userId} value={seat.userId}>{seat.email ?? seat.userId}</option>
                ))}
              </select>
            </div>
          </section>
        ) : null}

        {step === 'funders' ? (
          <section className="grid gap-4">
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-2">{t('merchant_advances.funders.columns.name')}</th>
                    <th className="p-2">{t('merchant_advances.funders.columns.method')}</th>
                    <th className="p-2">{t('merchant_advances.onboarding.funders.unstamped')}</th>
                  </tr>
                </thead>
                <tbody>
                  {funders.map((funder) => (
                    <tr key={funder.id} className="border-b border-border">
                      <td className="p-2">{funder.name}</td>
                      <td className="p-2">{funder.submitMethod}</td>
                      <td className="p-2">{funder.requiresUnstampedStatements ? t('merchant_advances.onboarding.yes') : t('merchant_advances.onboarding.no')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  await mutate(
                    () => readPayload('/api/merchant_advances/onboarding/funders/starter', { method: 'POST' }),
                    { starter: true },
                  )
                  await refreshFunders()
                  flash(t('merchant_advances.onboarding.funders.starterUsed'), 'success')
                }}
              >
                {t('merchant_advances.onboarding.funders.starter')}
              </Button>
            </div>
            <div className="grid max-w-2xl gap-3 rounded-md border border-border p-4">
              <h3 className="text-sm font-medium">{t('merchant_advances.onboarding.funders.add')}</h3>
              <Input placeholder={t('merchant_advances.onboarding.funders.name')} value={newFunder.name} onChange={(event) => setNewFunder({ ...newFunder, name: event.target.value })} />
              <Input placeholder={t('merchant_advances.onboarding.funders.code')} value={newFunder.code} onChange={(event) => setNewFunder({ ...newFunder, code: event.target.value })} />
              <RadioGroup value={newFunder.route} onValueChange={(value) => setNewFunder({ ...newFunder, route: value })}>
                <RadioField value="email" label={t('merchant_advances.method.email')} />
                <RadioField value="portal" label={t('merchant_advances.method.portal')} />
                <RadioField value="webhook" label={t('merchant_advances.method.webhook')} />
                <RadioField value="api_deferred" label={t('merchant_advances.onboarding.funders.apiDeferred')} />
              </RadioGroup>
              <Input type="email" placeholder={t('merchant_advances.onboarding.funders.contact')} value={newFunder.submitEmail} onChange={(event) => setNewFunder({ ...newFunder, submitEmail: event.target.value })} />
              <Input type="email" placeholder={t('merchant_advances.onboarding.funders.fromOverride')} value={newFunder.fromAddressOverride} onChange={(event) => setNewFunder({ ...newFunder, fromAddressOverride: event.target.value })} />
              <CheckboxField
                label={t('merchant_advances.onboarding.funders.unstamped')}
                checked={newFunder.requiresUnstampedStatements}
                onCheckedChange={(checked) => setNewFunder({ ...newFunder, requiresUnstampedStatements: Boolean(checked) })}
              />
              <div className="grid gap-2 md:grid-cols-2">
                {FUNDER_CRITERIA_KEYS.map((key) => (
                  <div key={key} className="grid gap-1">
                    <Label>{t(`merchant_advances.onboarding.criteria.${key}`)}</Label>
                    {CRITERIA_BOOL.has(key) ? (
                      <CheckboxField
                        label={t(`merchant_advances.onboarding.criteria.${key}`)}
                        checked={Boolean(newFunder.criteria[key])}
                        onCheckedChange={(checked) => setNewFunder({ ...newFunder, criteria: { ...newFunder.criteria, [key]: Boolean(checked) } })}
                      />
                    ) : (
                      <Input
                        value={Array.isArray(newFunder.criteria[key]) ? (newFunder.criteria[key] as string[]).join(', ') : String(newFunder.criteria[key] ?? '')}
                        onChange={(event) => {
                          const raw = event.target.value
                          const nextValue = CRITERIA_LIST.has(key)
                            ? raw.split(',').map((part) => part.trim()).filter(Boolean)
                            : (raw === '' ? undefined : Number.isFinite(Number(raw)) ? Number(raw) : raw)
                          setNewFunder({ ...newFunder, criteria: { ...newFunder.criteria, [key]: nextValue } })
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                onClick={async () => {
                  await mutate(
                    () => createCrud('merchant_advances/funders', {
                      name: newFunder.name,
                      code: newFunder.code || null,
                      route: newFunder.route,
                      submitEmail: newFunder.submitEmail || null,
                      fromAddressOverride: newFunder.fromAddressOverride || null,
                      requiresUnstampedStatements: newFunder.requiresUnstampedStatements,
                      criteria: newFunder.criteria,
                    }),
                    { name: newFunder.name },
                  )
                  await refreshFunders()
                  flash(t('merchant_advances.onboarding.funders.added'), 'success')
                }}
              >
                {t('merchant_advances.onboarding.funders.add')}
              </Button>
            </div>
            <div className="grid gap-2">
              <Label>{t('merchant_advances.onboarding.funders.csv')}</Label>
              <Textarea rows={6} value={csvText} onChange={(event) => setCsvText(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    const result = await mutate(
                      () => readPayload<{ preview: { readyCount: number; failedCount: number; rejectedSsnCount: number } }>('/api/merchant_advances/onboarding/funders/import', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ spreadsheetText: csvText, commit: false }),
                      }),
                      { commit: false },
                    )
                    setCsvPreview(t('merchant_advances.onboarding.funders.csvPreview', {
                      ready: String(result.preview.readyCount),
                      failed: String(result.preview.failedCount),
                      ssn: String(result.preview.rejectedSsnCount),
                    }))
                  }}
                >
                  {t('merchant_advances.onboarding.funders.csvPreviewAction')}
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    await mutate(
                      () => readPayload('/api/merchant_advances/onboarding/funders/import', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ spreadsheetText: csvText, commit: true }),
                      }),
                      { commit: true },
                    )
                    await refreshFunders()
                    flash(t('merchant_advances.onboarding.funders.csvImported'), 'success')
                  }}
                >
                  {t('merchant_advances.onboarding.funders.csvCommit')}
                </Button>
              </div>
              {csvPreview ? <p className="text-sm text-muted-foreground">{csvPreview}</p> : null}
            </div>
          </section>
        ) : null}

        {step === 'documents' ? (
          <section className="grid max-w-xl gap-4">
            <CheckboxField
              label={t('merchant_advances.onboarding.documents.stampFunder')}
              checked={state.documents.stampDestinationFunder}
              onCheckedChange={(checked) => setState({ ...state, documents: { ...state.documents, stampDestinationFunder: Boolean(checked) } })}
            />
            <CheckboxField
              label={t('merchant_advances.onboarding.documents.watermark')}
              checked={state.documents.watermarkEnabled}
              onCheckedChange={(checked) => setState({ ...state, documents: { ...state.documents, watermarkEnabled: Boolean(checked) } })}
            />
            <p className="text-sm text-muted-foreground">{t('merchant_advances.onboarding.documents.exception')}</p>
            <ul className="list-disc pl-5 text-sm">
              {funders.filter((funder) => funder.requiresUnstampedStatements).map((funder) => (
                <li key={funder.id}>{funder.name}</li>
              ))}
            </ul>
            <CheckboxField
              label={t('merchant_advances.settings.fields.uploadLinksEnabled')}
              checked={state.documents.uploadLinksEnabled}
              onCheckedChange={(checked) => setState({ ...state, documents: { ...state.documents, uploadLinksEnabled: Boolean(checked) } })}
            />
            <div className="grid gap-2">
              <Label>{t('merchant_advances.settings.fields.uploadLinkTtlHours')}</Label>
              <Input
                type="number"
                value={state.documents.uploadLinkTtlHours}
                onChange={(event) => setState({ ...state, documents: { ...state.documents, uploadLinkTtlHours: Number(event.target.value) || 72 } })}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                const result = await mutate(
                  () => readPayload<{ token: string; url: string; expiresAt: string }>('/api/merchant_advances/onboarding/upload-link', { method: 'POST' }),
                  { uploadLink: true },
                )
                setUploadLink(result.url)
                setUploadExpiresAt(result.expiresAt)
                flash(t('merchant_advances.onboarding.documents.linkIssued'), 'success')
              }}
            >
              {t('merchant_advances.onboarding.documents.testLink')}
            </Button>
            {uploadLink ? (
              <div className="grid gap-2 rounded-md border border-border p-4">
                <Label>{t('merchant_advances.onboarding.documents.endpointLabel')}</Label>
                <p className="text-sm text-muted-foreground">{t('merchant_advances.onboarding.documents.endpointHelp')}</p>
                <p className="text-sm">
                  <span className="font-medium">{t('merchant_advances.onboarding.documents.method')}</span>
                  {' '}
                  <code className="break-all text-xs">{uploadLink}</code>
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('merchant_advances.onboarding.documents.ttl', {
                    hours: String(state.documents.uploadLinkTtlHours),
                    when: uploadExpiresAt ? new Date(uploadExpiresAt).toLocaleString() : '',
                  })}
                </p>
                <div>
                  <Button type="button" variant="secondary" onClick={() => void copyText(uploadLink)}>{t('merchant_advances.onboarding.copy')}</Button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === 'extras' ? (
          <section className="grid max-w-xl gap-4">
            <p className="text-sm text-muted-foreground">{t('merchant_advances.onboarding.extras.help')}</p>
            <CheckboxField
              label={t('merchant_advances.onboarding.extras.sms')}
              checked={state.extras.sms.enabled}
              onCheckedChange={(checked) => setState({ ...state, extras: { ...state.extras, sms: { ...state.extras.sms, enabled: Boolean(checked) } } })}
            />
            <Input placeholder={t('merchant_advances.onboarding.extras.smsProvider')} value={state.extras.sms.providerName ?? ''} onChange={(event) => setState({ ...state, extras: { ...state.extras, sms: { ...state.extras.sms, providerName: event.target.value } } })} />
            <Input type="password" placeholder={t('merchant_advances.onboarding.extras.smsKey')} value={smsKey} onChange={(event) => setSmsKey(event.target.value)} />
            <p className="text-xs text-muted-foreground">{t('merchant_advances.onboarding.extras.smsStub')}</p>
            <CheckboxField
              label={t('merchant_advances.onboarding.extras.esign')}
              checked={state.extras.esign.enabled}
              onCheckedChange={(checked) => setState({ ...state, extras: { ...state.extras, esign: { ...state.extras.esign, enabled: Boolean(checked) } } })}
            />
            <RadioGroup
              value={state.extras.esign.provider ?? ''}
              onValueChange={(value) => setState({ ...state, extras: { ...state.extras, esign: { ...state.extras.esign, provider: value as 'docuseal' | 'hellosign' | 'other' } } })}
            >
              <RadioField value="docuseal" label={t('merchant_advances.onboarding.extras.esignDocuseal')} />
              <RadioField value="hellosign" label={t('merchant_advances.onboarding.extras.esignHellosign')} />
              <RadioField value="other" label={t('merchant_advances.onboarding.extras.esignOther')} />
            </RadioGroup>
            <Input type="password" placeholder={t('merchant_advances.onboarding.extras.esignKey')} value={esignKey} onChange={(event) => setEsignKey(event.target.value)} />
            <p className="text-xs text-muted-foreground">{t('merchant_advances.onboarding.extras.esignStub')}</p>
            <Input placeholder={t('merchant_advances.onboarding.extras.hook.offer')} value={state.extras.outboundWebhooks.offerCreated ?? ''} onChange={(event) => setState({ ...state, extras: { ...state.extras, outboundWebhooks: { ...state.extras.outboundWebhooks, offerCreated: event.target.value } } })} />
            <Input placeholder={t('merchant_advances.onboarding.extras.hook.reply')} value={state.extras.outboundWebhooks.replyParsed ?? ''} onChange={(event) => setState({ ...state, extras: { ...state.extras, outboundWebhooks: { ...state.extras.outboundWebhooks, replyParsed: event.target.value } } })} />
            <Input placeholder={t('merchant_advances.onboarding.extras.hook.failed')} value={state.extras.outboundWebhooks.submissionFailed ?? ''} onChange={(event) => setState({ ...state, extras: { ...state.extras, outboundWebhooks: { ...state.extras.outboundWebhooks, submissionFailed: event.target.value } } })} />
            <Input placeholder={t('merchant_advances.onboarding.extras.hook.renewal')} value={state.extras.outboundWebhooks.renewalSurfaced ?? ''} onChange={(event) => setState({ ...state, extras: { ...state.extras, outboundWebhooks: { ...state.extras.outboundWebhooks, renewalSurfaced: event.target.value } } })} />
          </section>
        ) : null}

        {step === 'first_deal' ? (
          <section className="grid max-w-xl gap-4">
            <p className="text-sm">{t('merchant_advances.onboarding.firstDeal.help')}</p>
            <ul className="grid gap-2">
              <li>
                <Button type="button" variant="secondary" onClick={async () => {
                  const result = await mutate(
                    () => readPayload<{ dealId: string }>('/api/merchant_advances/onboarding/first-deal', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ action: 'ensure' }),
                    }),
                    { action: 'ensure' },
                  )
                  setState({ ...state, firstDealId: result.dealId, firstDeal: { ...state.firstDeal, dealExists: true } })
                }}
                >
                  {state.firstDeal.dealExists ? t('merchant_advances.onboarding.firstDeal.dealDone') : t('merchant_advances.onboarding.firstDeal.deal')}
                </Button>
              </li>
              <li>
                <Button type="button" variant="secondary" onClick={async () => {
                  const result = await mutate(
                    () => readPayload<{ dealId: string; matchCount: number | null }>('/api/merchant_advances/onboarding/first-deal', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ action: 'score' }),
                    }),
                    { action: 'score' },
                  )
                  const listed = await readPayload<{ items?: MatchRow[] }>(`/api/merchant_advances/matches?dealId=${result.dealId}&pageSize=20`)
                  setMatches(listed.items ?? [])
                  setState({ ...state, firstDealId: result.dealId, firstDeal: { ...state.firstDeal, dealExists: true, rescored: true } })
                }}
                >
                  {t('merchant_advances.onboarding.firstDeal.score')}
                </Button>
              </li>
            </ul>
            {matches.length ? (
              <div className="grid gap-2">
                {matches.map((match) => match.funderId ? (
                  <CheckboxField
                    key={match.funderId}
                    label={`${funders.find((funder) => funder.id === match.funderId)?.name ?? match.funderId} · ${match.score ?? ''}`}
                    checked={state.firstDeal.selectedFunderIds.includes(match.funderId)}
                    onCheckedChange={(checked) => {
                      const ids = checked
                        ? [...state.firstDeal.selectedFunderIds, match.funderId as string]
                        : state.firstDeal.selectedFunderIds.filter((id) => id !== match.funderId)
                      setState({ ...state, firstDeal: { ...state.firstDeal, selectedFunderIds: ids } })
                    }}
                  />
                ) : null)}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    await mutate(
                      () => readPayload('/api/merchant_advances/onboarding/first-deal', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ action: 'select', funderIds: state.firstDeal.selectedFunderIds }),
                      }),
                      { action: 'select' },
                    )
                    flash(t('merchant_advances.onboarding.firstDeal.selected'), 'success')
                  }}
                >
                  {t('merchant_advances.onboarding.firstDeal.select')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    await mutate(
                      () => readPayload('/api/merchant_advances/onboarding/first-deal', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ action: 'submit', funderIds: state.firstDeal.selectedFunderIds }),
                      }),
                      { action: 'submit' },
                    )
                    flash(t('merchant_advances.onboarding.firstDeal.submitted'), 'success')
                  }}
                >
                  {t('merchant_advances.onboarding.firstDeal.submit')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    await mutate(
                      () => readPayload('/api/merchant_advances/onboarding/first-deal', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ action: 'reply' }),
                      }),
                      { action: 'reply' },
                    )
                    flash(t('merchant_advances.onboarding.firstDeal.replied'), 'success')
                  }}
                >
                  {t('merchant_advances.onboarding.firstDeal.reply')}
                </Button>
              </div>
            ) : null}
            {skipWarning ? (
              <Alert status="warning" style="lighter">
                <AlertDescription>{t('merchant_advances.onboarding.firstDeal.skipWarning')}</AlertDescription>
              </Alert>
            ) : null}
          </section>
        ) : null}
        </div>

        <div className="sticky bottom-0 z-sticky flex flex-wrap gap-2 border-t border-border bg-background py-3">
          {step !== 'welcome' ? (
            <Button type="button" variant="secondary" onClick={() => void go(prevStepOf(step))}>
              {t('merchant_advances.onboarding.back')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void save({
              shop: state.shop,
              seats: state.seats,
              intake: state.intake,
              senders: state.seats.filter((seat): seat is McaOnboardingSeat & { fromAddress: string } => Boolean(seat.fromAddress)).map((seat) => ({ userId: seat.userId, fromAddress: seat.fromAddress })),
              extras: { ...state.extras, smsApiKey: smsKey || undefined, esignApiKey: esignKey || undefined },
              documents: state.documents,
              firstDeal: state.firstDeal,
              firstDealId: state.firstDealId,
              defaultOriginatorUserId: state.defaultOriginatorUserId,
              step,
            }, 'merchant_advances.onboarding.saved')}
          >
            {t('merchant_advances.onboarding.saveExit')}
          </Button>
          {step === 'intake' && state.intake.source === 'unsure' ? (
            <Button type="button" variant="secondary" onClick={() => void save({ intake: state.intake, skipStep: 'intake', step: 'people' }, 'merchant_advances.onboarding.saved')}>
              {t('merchant_advances.onboarding.skip')}
            </Button>
          ) : null}
          {step === 'extras' ? (
            <Button type="button" variant="secondary" onClick={() => void save({ extras: state.extras, skipStep: 'extras', step: 'first_deal' }, 'merchant_advances.onboarding.saved')}>
              {t('merchant_advances.onboarding.skip')}
            </Button>
          ) : null}
          {step === 'first_deal' ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSkipWarning(true)
                  void save({ firstDeal: { ...state.firstDeal, skippedWithWarning: true }, complete: true, step: 'first_deal' }, 'merchant_advances.onboarding.completedFlash')
                    .then(() => router.push('/backend/merchant_advances'))
                }}
              >
                {t('merchant_advances.onboarding.firstDeal.skip')}
              </Button>
              <Button
                type="button"
                onClick={() => void save({
                  shop: state.shop,
                  seats: state.seats,
                  intake: state.intake,
                  documents: state.documents,
                  extras: { ...state.extras, smsApiKey: smsKey || undefined, esignApiKey: esignKey || undefined },
                  firstDeal: state.firstDeal,
                  firstDealId: state.firstDealId,
                  complete: true,
                  step: 'first_deal',
                }, 'merchant_advances.onboarding.completedFlash').then(() => router.push('/backend/merchant_advances'))}
              >
                {t('merchant_advances.onboarding.finish')}
              </Button>
            </>
          ) : step !== 'welcome' ? (
            <Button
              type="button"
              onClick={() => {
                if (step === 'people' && !state.seats.some((seat) => seat.floor === 'admin')) {
                  flash(t('merchant_advances.onboarding.people.needAdmin'), 'error')
                  return
                }
                void save({
                  shop: state.shop,
                  seats: state.seats,
                  intake: state.intake.source === 'spreadsheet' ? { ...state.intake, source: 'spreadsheet' } : state.intake,
                  extras: { ...state.extras, smsApiKey: smsKey || undefined, esignApiKey: esignKey || undefined },
                  documents: state.documents,
                  firstDeal: state.firstDeal,
                  firstDealId: state.firstDealId,
                  defaultOriginatorUserId: state.defaultOriginatorUserId,
                  fundersImported: funders.length > 0,
                  step: nextStepOf(step),
                })
              }}
            >
              {t('merchant_advances.onboarding.continue')}
            </Button>
          ) : null}
        </div>
      </PageBody>
    </Page>
  )
}
