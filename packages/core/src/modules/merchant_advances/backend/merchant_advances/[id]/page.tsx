"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { LoadingMessage, ErrorMessage, RecordNotFoundState } from '@open-mercato/ui/backend/detail'
import { SectionHeader } from '@open-mercato/ui/backend/SectionHeader'
import { NextStepCallout } from '@open-mercato/ui/backend/NextStepCallout'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { Button } from '@open-mercato/ui/primitives/button'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { pipelineStatusVariant } from '../../statusVariant'

type FirstPass = {
  avgMonthlyRevenue: string | null
  avgDailyBalance: string | null
  depositCount: number | null
  nsfCount: number | null
  negativeDays: number | null
  existingPositions: number | null
  industry: string | null
  timeInBusinessMonths: number | null
  position: number | null
  state: string | null
  requestedAmount: string | null
  humanReviewRequired: boolean
  autoSubmit: boolean
}

type AnalysisItem = {
  id: string
  model: string | null
  confidence: string | null
  notes: string | null
  reviewedAt: string | null
  reviewedByUserId: string | null
  updatedAt: string
  firstPass: FirstPass
}

type DealSummary = {
  id: string
  businessName: string
  pipelineStatus: string
  requestedAmount: string | null
  avgMonthlyRevenue: string | null
  timeInBusinessMonths: number | null
  position: number | null
  industry: string | null
  state: string | null
  updatedAt: string
}

type AnalysesResponse = {
  items?: AnalysisItem[]
  deal?: DealSummary
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

export default function MerchantAdvancesDealDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const dealId = params.id
  const [data, setData] = React.useState<AnalysesResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    const result = await readApiResultOrThrow<AnalysesResponse>(
      `/api/merchant_advances/analyses?dealId=${encodeURIComponent(dealId)}`,
    )
    setData(result)
  }, [dealId])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await load()
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t('merchant_advances.errors.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [load, t])

  const { runMutation, retryLastMutation } = useGuardedMutation({
    contextId: 'merchant_advances.statement.review',
    blockedMessage: t('merchant_advances.analysis.reviewBlocked'),
  })

  const latest = data?.items?.[0] ?? null
  const deal = data?.deal ?? null

  const markReviewed = async () => {
    if (!latest) return
    await runMutation({
      context: {
        formId: 'merchant_advances.statement.review',
        resourceKind: 'merchant_advances.statement_analysis',
        retryLastMutation,
      },
      mutationPayload: { id: latest.id },
      operation: async () => {
        await readApiResultOrThrow('/api/merchant_advances/analyses/review', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: latest.id, updatedAt: latest.updatedAt }),
        })
        await load()
        flash(t('merchant_advances.analysis.reviewedFlash'), 'success')
      },
    })
  }

  const rerun = async () => {
    await runMutation({
      context: {
        formId: 'merchant_advances.statement.analyze',
        resourceKind: 'merchant_advances.statement_analysis',
        retryLastMutation,
      },
      mutationPayload: { dealId },
      operation: async () => {
        await readApiResultOrThrow('/api/merchant_advances/analyses/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dealId, force: true }),
        })
        await load()
        flash(t('merchant_advances.analysis.queuedFlash'), 'success')
      },
    })
  }

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('merchant_advances.common.loading')} />
        </PageBody>
      </Page>
    )
  }

  if (error) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={t('merchant_advances.errors.loadFailed')} description={error} />
        </PageBody>
      </Page>
    )
  }

  if (!deal) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t('merchant_advances.errors.dealNotFound')}
            backHref="/backend/merchant_advances"
            backLabel={t('merchant_advances.nav.deals')}
          />
        </PageBody>
      </Page>
    )
  }

  const firstPass = latest?.firstPass
  const fields = [
    { key: 'requested', label: t('merchant_advances.deals.fields.requestedAmount'), value: displayValue(deal.requestedAmount) },
    { key: 'revenue', label: t('merchant_advances.deals.fields.avgMonthlyRevenue'), value: displayValue(firstPass?.avgMonthlyRevenue ?? deal.avgMonthlyRevenue) },
    { key: 'adb', label: t('merchant_advances.analysis.avgDailyBalance'), value: displayValue(firstPass?.avgDailyBalance) },
    { key: 'deposits', label: t('merchant_advances.analysis.depositCount'), value: displayValue(firstPass?.depositCount) },
    { key: 'nsf', label: t('merchant_advances.analysis.nsfCount'), value: displayValue(firstPass?.nsfCount) },
    { key: 'negative', label: t('merchant_advances.analysis.negativeDays'), value: displayValue(firstPass?.negativeDays) },
    { key: 'positions', label: t('merchant_advances.analysis.existingPositions'), value: displayValue(firstPass?.existingPositions ?? deal.position) },
    { key: 'industry', label: t('merchant_advances.deals.fields.industry'), value: displayValue(deal.industry) },
    { key: 'tib', label: t('merchant_advances.deals.fields.timeInBusinessMonths'), value: displayValue(deal.timeInBusinessMonths) },
    { key: 'state', label: t('merchant_advances.deals.fields.state'), value: displayValue(deal.state) },
  ]

  return (
    <Page>
      <PageBody>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{deal.businessName}</h1>
            <p className="text-sm text-muted-foreground">{t('merchant_advances.detail.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant={pipelineStatusVariant(deal.pipelineStatus)}>
              {t(`merchant_advances.status.${deal.pipelineStatus}`)}
            </StatusBadge>
            <Button variant="outline" onClick={() => router.push('/backend/merchant_advances')}>
              {t('merchant_advances.detail.back')}
            </Button>
          </div>
        </div>

        <NextStepCallout
          title={t('merchant_advances.analysis.calloutTitle')}
          description={t('merchant_advances.analysis.calloutBody')}
          actionLabel={t('merchant_advances.analysis.markReviewed')}
          onAction={() => { void markReviewed() }}
          disabled={!latest || Boolean(latest.reviewedAt)}
          disabledMessage={latest?.reviewedAt ? t('merchant_advances.analysis.alreadyReviewed') : t('merchant_advances.analysis.noAnalysis')}
          status={{
            tone: latest?.reviewedAt ? 'success' : 'warning',
            label: latest?.reviewedAt
              ? t('merchant_advances.analysis.reviewed')
              : t('merchant_advances.analysis.needsReview'),
          }}
        />

        <div className="mt-6 space-y-4">
          <SectionHeader
            title={t('merchant_advances.analysis.title')}
            count={data?.items?.length ?? 0}
            action={(
              <Button variant="outline" onClick={() => { void rerun() }}>
                {t('merchant_advances.analysis.rerun')}
              </Button>
            )}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {fields.map((field) => (
              <div key={field.key} className="rounded-md border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground">{field.label}</div>
                <div className="mt-1 text-sm font-medium">{field.value}</div>
              </div>
            ))}
          </div>
          {latest?.notes ? (
            <p className="text-sm text-muted-foreground">{latest.notes}</p>
          ) : null}
          {latest?.model ? (
            <p className="text-xs text-muted-foreground">
              {t('merchant_advances.analysis.model', 'Model {model} · confidence {confidence}', {
                model: latest.model,
                confidence: latest.confidence ?? '—',
              })}
            </p>
          ) : null}
        </div>
      </PageBody>
    </Page>
  )
}
