"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import {
  ErrorMessage,
  LoadingMessage,
  RecordNotFoundState,
  TabEmptyState,
} from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { NextStepCallout } from '@open-mercato/ui/backend/NextStepCallout'
import { SectionHeader } from '@open-mercato/ui/backend/SectionHeader'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { apiCall, readApiResultOrThrow, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@open-mercato/ui/primitives/tabs'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  MCA_PAYMENT_FREQUENCIES,
  MCA_REPLY_CLASSIFICATIONS,
  type McaPipelineStatus,
} from '../../../data/constants'
import { canTransition } from '../../../lib/pipeline'
import { CommissionSplits, type CommissionSplitRow } from '../../components/CommissionSplits'
import { FunderMatchList, type FunderMatchRow } from '../../components/FunderMatchList'
import { pipelineStatusVariant } from '../statusVariant'

type Deal = {
  id: string
  businessName: string | null
  pipelineStatus: McaPipelineStatus | null
  requestedAmount: string | null
  avgMonthlyRevenue: string | null
  timeInBusinessMonths: number | null
  position: number | null
  industry: string | null
  state: string | null
  ownerUserId: string | null
  updatedAt: string | null
}

type Offer = {
  id: string
  funderId: string | null
  amount: string | null
  factor: string | null
  termMonths: number | null
  paymentAmount: string | null
  paymentFrequency: string | null
  commissionPoints: string | null
  stips: unknown
  status: string | null
  updatedAt: string | null
}

type Submission = {
  id: string
  funderId: string | null
  method: string | null
  status: string | null
  funderReference: string | null
}

type Reply = {
  id: string
  classification: string | null
  rawSource: string | null
  rawBody: string | null
  parsedPayload: Record<string, unknown> | null
  createdAt: string | null
}

type Funding = {
  id: string
  fundedAmount: string | null
  paybackAmount: string | null
  paymentAmount: string | null
  paidInPct: string | null
  fundedAt: string | null
  commission?: {
    points: string | null
    amount: string | null
    splits: CommissionSplitRow[]
  } | null
}

type Renewal = {
  id: string
  status: string | null
  paidInPct: string | null
  updatedAt: string | null
}

type Funder = { id: string; name: string | null }

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

type MatchRow = FunderMatchRow

const SELECTED_FUNDERS_KEY = (dealId: string) => `mca:selected-funders:${dealId}`

type ListResponse<T> = { items?: T[] }

type TabId =
  | 'overview'
  | 'statements'
  | 'matches'
  | 'submissions'
  | 'replies'
  | 'offers'
  | 'funding'
  | 'renewals'
  | 'activity'

const TABS: TabId[] = [
  'overview', 'statements', 'matches', 'submissions', 'replies', 'offers', 'funding', 'renewals', 'activity',
]

const WRITEBACK = ['contacted', 'renewed', 'lost'] as const

function asList<T>(value: unknown): T[] {
  if (value && typeof value === 'object' && Array.isArray((value as ListResponse<T>).items)) {
    return (value as ListResponse<T>).items ?? []
  }
  return []
}

async function loadList<T>(url: string): Promise<T[]> {
  try {
    const result = await apiCall<ListResponse<T>>(url)
    return result.ok ? asList<T>(result.result) : []
  } catch {
    return []
  }
}

function stipLines(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.filter((item): item is string => typeof item === 'string').join('\n')
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function ReadOnlyFieldGrid({
  fields,
}: {
  fields: { key: string; label: string; value: string | number | null | undefined }[]
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {fields.map((field) => (
        <div key={field.key} className="rounded-md border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">{field.label}</div>
          <div className="mt-1 text-sm font-medium">{displayValue(field.value)}</div>
        </div>
      ))}
    </div>
  )
}

const DEAL_PATH_ID = /\/backend\/merchant_advances\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

function readDealIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const match = window.location.pathname.match(DEAL_PATH_ID)
  return match?.[1] ?? null
}

export default function MerchantAdvancesDealDetailPage({ params }: { params?: { id?: string } }) {
  const [id, setId] = React.useState<string | null>(() => (
    params && typeof params === 'object' && typeof params.id === 'string' && params.id
      ? params.id
      : null
  ))
  const t = useT()
  const [tab, setTab] = React.useState<TabId>('overview')
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [deal, setDeal] = React.useState<Deal | null>(null)
  const [offers, setOffers] = React.useState<Offer[]>([])
  const [submissions, setSubmissions] = React.useState<Submission[]>([])
  const [replies, setReplies] = React.useState<Reply[]>([])
  const [fundings, setFundings] = React.useState<Funding[]>([])
  const [renewals, setRenewals] = React.useState<Renewal[]>([])
  const [funders, setFunders] = React.useState<Funder[]>([])
  const [matches, setMatches] = React.useState<MatchRow[]>([])
  const [selectedFunderIds, setSelectedFunderIds] = React.useState<string[]>([])
  const [offerDraft, setOfferDraft] = React.useState({
    amount: '75000',
    factor: '1.32',
    termMonths: '6',
    paymentFrequency: 'daily',
    commissionPoints: '10',
    funderId: '',
    stips: '',
  })
  const [replyDraft, setReplyDraft] = React.useState({ body: '', classification: 'other' })
  const [stipDraft, setStipDraft] = React.useState('')
  const [analyses, setAnalyses] = React.useState<AnalysisItem[]>([])

  const { runMutation, retryLastMutation } = useGuardedMutation({
    contextId: `merchant-advances-deal-${id}`,
    blockedMessage: t('merchant_advances.errors.saveBlocked'),
  })
  const mutationContext = React.useMemo(() => ({
    formId: `merchant-advances-deal-${id ?? 'pending'}`,
    resourceKind: 'merchant_advances.deal',
    resourceId: id ?? '',
    retryLastMutation,
  }), [id, retryLastMutation])

  const funderName = React.useCallback((funderId: string | null) => {
    if (!funderId) return '—'
    return funders.find((funder) => funder.id === funderId)?.name ?? funderId
  }, [funders])

  const load = React.useCallback(async () => {
    const dealId = id ?? readDealIdFromLocation()
    if (!dealId) {
      setDeal(null)
      setNotFound(true)
      setError(false)
      setLoading(false)
      return
    }
    if (id !== dealId) setId(dealId)
    setLoading(true)
    setError(false)
    setNotFound(false)
    const dealQuery = `/api/merchant_advances/deals?id=${encodeURIComponent(dealId)}&pageSize=1`
    const loadDeal = async () => {
      const dealsRes = await readApiResultOrThrow<ListResponse<Deal>>(dealQuery)
      return asList<Deal>(dealsRes)[0] ?? null
    }
    try {
      let nextDeal: Deal | null = null
      try {
        nextDeal = await loadDeal()
      } catch {
        await new Promise((resolve) => window.setTimeout(resolve, 400))
        nextDeal = await loadDeal()
      }
      if (!nextDeal) {
        setNotFound(true)
        setDeal(null)
        return
      }
      setDeal(nextDeal)
      const [offers, submissions, replies, fundings, renewals, nextFunders, matchRows, analyses] = await Promise.all([
        loadList<Offer>(`/api/merchant_advances/offers?dealId=${encodeURIComponent(dealId)}&pageSize=100`),
        loadList<Submission>(`/api/merchant_advances/submissions?dealId=${encodeURIComponent(dealId)}&pageSize=100`),
        loadList<Reply>(`/api/merchant_advances/replies?dealId=${encodeURIComponent(dealId)}&pageSize=100`),
        loadList<Funding>(`/api/merchant_advances/fundings?dealId=${encodeURIComponent(dealId)}&pageSize=100`),
        loadList<Renewal>(`/api/merchant_advances/renewals?dealId=${encodeURIComponent(dealId)}&pageSize=100`),
        loadList<Funder>('/api/merchant_advances/funders?pageSize=100'),
        loadList<MatchRow>(`/api/merchant_advances/matches?dealId=${encodeURIComponent(dealId)}&pageSize=100&sortField=rank&sortDir=asc`),
        loadList<AnalysisItem>(`/api/merchant_advances/analyses?dealId=${encodeURIComponent(dealId)}`),
      ])
      setOffers(offers)
      setSubmissions(submissions)
      setReplies(replies)
      setFundings(fundings)
      setRenewals(renewals)
      setFunders(nextFunders)
      setAnalyses(analyses)
      const nextMatches = matchRows.map((match) => ({
        ...match,
        funderName: nextFunders.find((funder) => funder.id === match.funderId)?.name ?? match.funderId,
        reasons: Array.isArray(match.reasons) ? match.reasons : [],
      }))
      setMatches(nextMatches)
      try {
        const stored = window.sessionStorage.getItem(SELECTED_FUNDERS_KEY(dealId))
        const parsed = stored ? JSON.parse(stored) : []
        setSelectedFunderIds(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [])
      } catch {
        setSelectedFunderIds([])
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    const fromPath = readDealIdFromLocation()
    if (fromPath) {
      setId((current) => current ?? fromPath)
      return
    }
    if (!id) {
      setNotFound(true)
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    if (!id) return
    void load()
  }, [id, load])

  const runDealWrite = async (operation: () => Promise<unknown>, successKey: string) => {
    try {
      await runMutation({
        operation,
        context: mutationContext,
      })
      flash(t(successKey), 'success')
      await load()
    } catch (err) {
      surfaceRecordConflict(err, t, { onRefresh: load })
    }
  }

  const addOffer = async () => {
    if (!deal) return
    const termMonths = Number(offerDraft.termMonths)
    await runDealWrite(async () => {
      await createCrud('merchant_advances/offers', {
        dealId: deal.id,
        funderId: offerDraft.funderId || null,
        amount: offerDraft.amount,
        factor: offerDraft.factor,
        termMonths: Number.isFinite(termMonths) ? termMonths : null,
        paymentFrequency: offerDraft.paymentFrequency,
        commissionPoints: offerDraft.commissionPoints,
        stips: offerDraft.stips.split('\n').map((line) => line.trim()).filter(Boolean),
        status: 'open',
      })
    }, 'merchant_advances.detail.offerAdded')
  }

  const acceptOffer = async (offer: Offer) => {
    if (!deal) return
    await runDealWrite(async () => {
      await withScopedApiRequestHeaders(
        buildOptimisticLockHeader(deal.updatedAt),
        () => createCrud('merchant_advances/fundings', {
          offerId: offer.id,
          dealUpdatedAt: deal.updatedAt,
          offerUpdatedAt: offer.updatedAt,
        }),
      )
    }, 'merchant_advances.detail.offerAccepted')
  }

  const markDecline = async () => {
    if (!deal || !canTransition(deal.pipelineStatus ?? 'new_app', 'declined')) return
    await runDealWrite(async () => {
      await withScopedApiRequestHeaders(
        buildOptimisticLockHeader(deal.updatedAt),
        () => updateCrud('merchant_advances/deals', { id: deal.id, pipelineStatus: 'declined' }),
      )
    }, 'merchant_advances.detail.markedDeclined')
  }

  const addStips = async (offer: Offer) => {
    const lines = stipDraft.split('\n').map((line) => line.trim()).filter(Boolean)
    await runDealWrite(async () => {
      await withScopedApiRequestHeaders(
        buildOptimisticLockHeader(offer.updatedAt),
        () => updateCrud('merchant_advances/offers', { id: offer.id, stips: lines }),
      )
    }, 'merchant_advances.detail.stipsSaved')
  }

  const pasteReply = async () => {
    if (!deal || !replyDraft.body.trim()) return
    await runDealWrite(async () => {
      await createCrud('merchant_advances/replies', {
        dealId: deal.id,
        rawSource: 'manual',
        classification: replyDraft.classification,
        rawBody: replyDraft.body,
      })
    }, 'merchant_advances.detail.replySaved')
    setReplyDraft({ body: '', classification: 'other' })
  }

  const toggleFunder = (funderId: string) => {
    setSelectedFunderIds((current) => {
      const next = current.includes(funderId)
        ? current.filter((id) => id !== funderId)
        : [...current, funderId]
      window.sessionStorage.setItem(SELECTED_FUNDERS_KEY(id), JSON.stringify(next))
      return next
    })
  }

  const submitSelected = async () => {
    if (!deal || !selectedFunderIds.length) return
    await runDealWrite(async () => {
      const result = await apiCall<{ results?: Array<{ error?: string | null }> }>(
        '/api/merchant_advances/submissions/send',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dealId: deal.id, funderIds: selectedFunderIds }),
        },
      )
      if (result.status === 409) {
        throw new Error(t('merchant_advances.errors.duplicateSubmission'))
      }
      if (!result.ok) {
        throw new Error(t('merchant_advances.detail.submissions.submitFailed'))
      }
    }, 'merchant_advances.detail.submissions.submitted')
  }

  const resubmitFunder = async (funderId: string | null) => {
    if (!deal || !funderId) return
    await runDealWrite(async () => {
      const result = await apiCall(
        '/api/merchant_advances/submissions/send',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dealId: deal.id, funderIds: [funderId] }),
        },
      )
      if (!result.ok) {
        throw new Error(t('merchant_advances.detail.submissions.submitFailed'))
      }
    }, 'merchant_advances.detail.submissions.submitted')
  }

  const refreshMatches = async () => {
    if (!deal) return
    await runDealWrite(async () => {
      const result = await apiCall('/api/merchant_advances/matches/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      })
      if (!result.ok) {
        throw new Error(t('merchant_advances.detail.matches.refreshFailed'))
      }
    }, 'merchant_advances.detail.matches.refreshed')
  }

  const writeRenewal = async (renewal: Renewal, status: string) => {
    await runDealWrite(async () => {
      await withScopedApiRequestHeaders(
        buildOptimisticLockHeader(renewal.updatedAt),
        () => updateCrud('merchant_advances/renewals', { id: renewal.id, status }),
      )
    }, 'merchant_advances.detail.renewalUpdated')
  }

  const markAnalysisReviewed = async (analysis: AnalysisItem) => {
    try {
      await runMutation({
        context: {
          formId: 'merchant_advances.statement.review',
          resourceKind: 'merchant_advances.statement_analysis',
          resourceId: analysis.id,
          retryLastMutation,
        },
        mutationPayload: { id: analysis.id },
        operation: async () => {
          await withScopedApiRequestHeaders(
            buildOptimisticLockHeader(analysis.updatedAt),
            () => readApiResultOrThrow('/api/merchant_advances/analyses/review', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id: analysis.id, updatedAt: analysis.updatedAt }),
            }),
          )
          await load()
          flash(t('merchant_advances.analysis.reviewedFlash'), 'success')
        },
      })
    } catch (err) {
      surfaceRecordConflict(err, t, { onRefresh: load })
    }
  }

  const rerunAnalysis = async () => {
    if (!deal) return
    try {
      await runMutation({
        context: {
          formId: 'merchant_advances.statement.analyze',
          resourceKind: 'merchant_advances.statement_analysis',
          resourceId: deal.id,
          retryLastMutation,
        },
        mutationPayload: { dealId: deal.id },
        operation: async () => {
          await readApiResultOrThrow('/api/merchant_advances/analyses/analyze', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ dealId: deal.id, force: true }),
          })
          await load()
          flash(t('merchant_advances.analysis.queuedFlash'), 'success')
        },
      })
    } catch (err) {
      surfaceRecordConflict(err, t, { onRefresh: load })
    }
  }

  if (loading) {
    return <Page><PageBody><LoadingMessage label={t('merchant_advances.common.loading')} /></PageBody></Page>
  }
  if (notFound) {
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
  if (error || !deal) {
    return <Page><PageBody><ErrorMessage label={t('merchant_advances.detail.loadError')} /></PageBody></Page>
  }

  const funding = fundings[0] ?? null
  const openOffers = offers.filter((offer) => offer.status === 'open')
  const latestAnalysis = analyses[0] ?? null
  const firstPass = latestAnalysis?.firstPass
  const analysisFields = [
    { key: 'requested', label: t('merchant_advances.deals.fields.requestedAmount'), value: firstPass?.requestedAmount ?? deal.requestedAmount },
    { key: 'revenue', label: t('merchant_advances.deals.fields.avgMonthlyRevenue'), value: firstPass?.avgMonthlyRevenue ?? deal.avgMonthlyRevenue },
    { key: 'adb', label: t('merchant_advances.analysis.avgDailyBalance'), value: firstPass?.avgDailyBalance },
    { key: 'deposits', label: t('merchant_advances.analysis.depositCount'), value: firstPass?.depositCount },
    { key: 'nsf', label: t('merchant_advances.analysis.nsfCount'), value: firstPass?.nsfCount },
    { key: 'negative', label: t('merchant_advances.analysis.negativeDays'), value: firstPass?.negativeDays },
    { key: 'positions', label: t('merchant_advances.analysis.existingPositions'), value: firstPass?.existingPositions ?? deal.position },
    { key: 'industry', label: t('merchant_advances.deals.fields.industry'), value: firstPass?.industry ?? deal.industry },
    { key: 'tib', label: t('merchant_advances.deals.fields.timeInBusinessMonths'), value: firstPass?.timeInBusinessMonths ?? deal.timeInBusinessMonths },
    { key: 'state', label: t('merchant_advances.deals.fields.state'), value: firstPass?.state ?? deal.state },
  ]

  return (
    <Page>
      <PageBody>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{deal.businessName ?? t('merchant_advances.detail.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('merchant_advances.detail.subtitle')}</p>
          </div>
          <StatusBadge variant={pipelineStatusVariant(deal.pipelineStatus)}>
            {deal.pipelineStatus ? t(`merchant_advances.status.${deal.pipelineStatus}`) : '—'}
          </StatusBadge>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)} variant="underline">
          <TabsList className="h-auto w-full flex-wrap" aria-label={t('merchant_advances.detail.tabs.label')}>
            {TABS.map((tabId) => (
              <TabsTrigger key={tabId} value={tabId}>
                {t(`merchant_advances.detail.tabs.${tabId}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <ReadOnlyFieldGrid
              fields={[
                { key: 'businessName', label: t('merchant_advances.deals.fields.businessName'), value: deal.businessName },
                { key: 'requestedAmount', label: t('merchant_advances.deals.fields.requestedAmount'), value: deal.requestedAmount },
                { key: 'avgMonthlyRevenue', label: t('merchant_advances.deals.fields.avgMonthlyRevenue'), value: deal.avgMonthlyRevenue },
                { key: 'timeInBusinessMonths', label: t('merchant_advances.deals.fields.timeInBusinessMonths'), value: deal.timeInBusinessMonths },
                { key: 'position', label: t('merchant_advances.deals.fields.position'), value: deal.position },
                { key: 'industry', label: t('merchant_advances.deals.fields.industry'), value: deal.industry },
                { key: 'state', label: t('merchant_advances.deals.fields.state'), value: deal.state },
              ]}
            />
          </TabsContent>

          <TabsContent value="statements" className="mt-6 space-y-4">
            {!latestAnalysis ? (
              <div className="space-y-4">
                <TabEmptyState
                  title={t('merchant_advances.detail.statements.empty')}
                  description={t('merchant_advances.detail.statements.hint')}
                />
                <Button type="button" variant="outline" onClick={() => { void rerunAnalysis() }}>
                  {t('merchant_advances.analysis.analyze')}
                </Button>
              </div>
            ) : (
              <>
                <NextStepCallout
                  title={t('merchant_advances.analysis.calloutTitle')}
                  description={t('merchant_advances.analysis.calloutBody')}
                  actionLabel={t('merchant_advances.analysis.markReviewed')}
                  onAction={() => { void markAnalysisReviewed(latestAnalysis) }}
                  disabled={Boolean(latestAnalysis.reviewedAt)}
                  disabledMessage={latestAnalysis.reviewedAt ? t('merchant_advances.analysis.alreadyReviewed') : t('merchant_advances.analysis.noAnalysis')}
                  status={{
                    tone: latestAnalysis.reviewedAt ? 'success' : 'warning',
                    label: latestAnalysis.reviewedAt
                      ? t('merchant_advances.analysis.reviewed')
                      : t('merchant_advances.analysis.needsReview'),
                  }}
                />
                <SectionHeader
                  title={t('merchant_advances.analysis.title')}
                  count={analyses.length}
                  action={(
                    <Button type="button" variant="outline" onClick={() => { void rerunAnalysis() }}>
                      {t('merchant_advances.analysis.rerun')}
                    </Button>
                  )}
                />
                <ReadOnlyFieldGrid fields={analysisFields} />
                {latestAnalysis.notes ? (
                  <p className="text-sm text-muted-foreground">{latestAnalysis.notes}</p>
                ) : null}
                {latestAnalysis.model ? (
                  <p className="text-xs text-muted-foreground">
                    {t('merchant_advances.analysis.model', {
                      model: latestAnalysis.model,
                      confidence: latestAnalysis.confidence ?? '—',
                    })}
                  </p>
                ) : null}
              </>
            )}
          </TabsContent>

          <TabsContent value="matches" className="mt-6">
            <FunderMatchList
              matches={matches}
              selectedFunderIds={selectedFunderIds}
              onToggle={toggleFunder}
              onRefresh={() => void refreshMatches()}
              onSubmit={() => void submitSelected()}
            />
          </TabsContent>

          <TabsContent value="submissions" className="mt-6">
            {submissions.length ? (
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">{t('merchant_advances.funders.columns.name')}</th>
                    <th className="py-2 text-left">{t('merchant_advances.funders.columns.method')}</th>
                    <th className="py-2 text-left">{t('merchant_advances.offers.columns.status')}</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="py-2">{funderName(row.funderId)}</td>
                      <td className="py-2">{row.method ? t(`merchant_advances.method.${row.method}`) : '—'}</td>
                      <td className="py-2">{row.status ?? '—'}</td>
                      <td className="py-2 text-right">
                        {row.status === 'error' && row.funderId ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => void resubmitFunder(row.funderId)}>
                            {t('merchant_advances.detail.submissions.resubmit')}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <TabEmptyState
                title={t('merchant_advances.detail.submissions.empty')}
                description={t('merchant_advances.detail.submissions.hint')}
              />
            )}
          </TabsContent>

          <TabsContent value="replies" className="mt-6">
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium">{t('merchant_advances.detail.replies.paste')}</h2>
              <textarea
                className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={replyDraft.body}
                onChange={(event) => setReplyDraft((current) => ({ ...current, body: event.target.value }))}
                placeholder={t('merchant_advances.detail.replies.placeholder')}
              />
              <select
                className="w-48 rounded-md border border-input bg-background px-2 py-1 text-sm"
                value={replyDraft.classification}
                onChange={(event) => setReplyDraft((current) => ({ ...current, classification: event.target.value }))}
              >
                {MCA_REPLY_CLASSIFICATIONS.map((item) => (
                  <option key={item} value={item}>{t(`merchant_advances.reply.${item}`)}</option>
                ))}
              </select>
              <div>
                <Button type="button" onClick={() => void pasteReply()}>{t('merchant_advances.detail.replies.save')}</Button>
              </div>
            </div>
            {replies.length ? (
              <ul className="space-y-3">
                {replies.map((reply) => (
                  <li key={reply.id} className="rounded-md border border-border p-3">
                    <div className="text-sm font-medium">
                      {reply.classification ? t(`merchant_advances.reply.${reply.classification}`) : '—'}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{reply.rawBody ?? '—'}</p>
                    {reply.parsedPayload ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t('merchant_advances.detail.replies.parsed')}: {[
                          reply.parsedPayload.amount,
                          reply.parsedPayload.factor,
                          reply.parsedPayload.termMonths,
                          reply.parsedPayload.paymentAmount,
                        ].filter((value) => value != null && value !== '').join(' · ')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <TabEmptyState
                title={t('merchant_advances.detail.replies.empty')}
                description={t('merchant_advances.detail.replies.hint')}
              />
            )}
          </TabsContent>

          <TabsContent value="offers" className="mt-6">
            <div className="mb-6 grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2">
              <Input value={offerDraft.amount} onChange={(event) => setOfferDraft((current) => ({ ...current, amount: event.target.value }))} placeholder={t('merchant_advances.offers.columns.amount')} />
              <Input value={offerDraft.factor} onChange={(event) => setOfferDraft((current) => ({ ...current, factor: event.target.value }))} placeholder={t('merchant_advances.offers.columns.factor')} />
              <Input value={offerDraft.termMonths} onChange={(event) => setOfferDraft((current) => ({ ...current, termMonths: event.target.value }))} placeholder={t('merchant_advances.offers.columns.term')} />
              <Input value={offerDraft.commissionPoints} onChange={(event) => setOfferDraft((current) => ({ ...current, commissionPoints: event.target.value }))} placeholder={t('merchant_advances.offers.columns.points')} />
              <select
                className="rounded-md border border-input bg-background px-2 py-2 text-sm"
                value={offerDraft.paymentFrequency}
                onChange={(event) => setOfferDraft((current) => ({ ...current, paymentFrequency: event.target.value }))}
              >
                {MCA_PAYMENT_FREQUENCIES.map((item) => (
                  <option key={item} value={item}>{t(`merchant_advances.frequency.${item}`)}</option>
                ))}
              </select>
              <select
                className="rounded-md border border-input bg-background px-2 py-2 text-sm"
                value={offerDraft.funderId}
                onChange={(event) => setOfferDraft((current) => ({ ...current, funderId: event.target.value }))}
              >
                <option value="">{t('merchant_advances.detail.offers.noFunder')}</option>
                {funders.map((funder) => (
                  <option key={funder.id} value={funder.id}>{funder.name}</option>
                ))}
              </select>
              <textarea
                className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
                value={offerDraft.stips}
                onChange={(event) => setOfferDraft((current) => ({ ...current, stips: event.target.value }))}
                placeholder={t('merchant_advances.offers.columns.stips')}
              />
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button type="button" onClick={() => void addOffer()}>{t('merchant_advances.detail.offers.add')}</Button>
                <Button type="button" variant="outline" onClick={() => void markDecline()}>{t('merchant_advances.detail.offers.decline')}</Button>
              </div>
            </div>

            {offers.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-2 text-left">{t('merchant_advances.funders.columns.name')}</th>
                      <th className="py-2 text-left">{t('merchant_advances.offers.columns.amount')}</th>
                      <th className="py-2 text-left">{t('merchant_advances.offers.columns.factor')}</th>
                      <th className="py-2 text-left">{t('merchant_advances.offers.columns.term')}</th>
                      <th className="py-2 text-left">{t('merchant_advances.offers.columns.payment')}</th>
                      <th className="py-2 text-left">{t('merchant_advances.offers.columns.points')}</th>
                      <th className="py-2 text-left">{t('merchant_advances.offers.columns.stips')}</th>
                      <th className="py-2 text-left">{t('merchant_advances.offers.columns.status')}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((offer) => (
                      <tr key={offer.id} className="border-t border-border">
                        <td className="py-2">{funderName(offer.funderId)}</td>
                        <td className="py-2">{offer.amount ?? '—'}</td>
                        <td className="py-2">{offer.factor ?? '—'}</td>
                        <td className="py-2">{offer.termMonths ?? '—'}</td>
                        <td className="py-2">{offer.paymentAmount ?? '—'}</td>
                        <td className="py-2">{offer.commissionPoints ?? '—'}</td>
                        <td className="py-2 whitespace-pre-wrap">{stipLines(offer.stips) || '—'}</td>
                        <td className="py-2">{offer.status ?? '—'}</td>
                        <td className="py-2 text-right">
                          {offer.status === 'open' ? (
                            <Button type="button" size="sm" onClick={() => void acceptOffer(offer)}>
                              {t('merchant_advances.detail.offers.accept')}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <TabEmptyState title={t('merchant_advances.offers.empty.title')} description={t('merchant_advances.offers.empty.description')} />
            )}

            {openOffers[0] ? (
              <div className="mt-6 flex flex-col gap-2">
                <textarea
                  className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={stipDraft}
                  onChange={(event) => setStipDraft(event.target.value)}
                  placeholder={t('merchant_advances.detail.offers.stipPlaceholder')}
                />
                <div>
                  <Button type="button" variant="outline" onClick={() => void addStips(openOffers[0])}>
                    {t('merchant_advances.detail.offers.saveStips')}
                  </Button>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="funding" className="mt-6">
            {funding ? (
              <div className="flex flex-col gap-6">
                <ReadOnlyFieldGrid
                  fields={[
                    { key: 'fundedAmount', label: t('merchant_advances.funding.fundedAmount'), value: funding.fundedAmount },
                    { key: 'payback', label: t('merchant_advances.funding.payback'), value: funding.paybackAmount },
                    { key: 'payment', label: t('merchant_advances.funding.payment'), value: funding.paymentAmount },
                    { key: 'paidIn', label: t('merchant_advances.pipeline.paidIn'), value: funding.paidInPct },
                    { key: 'fundedAt', label: t('merchant_advances.funding.fundedAt'), value: funding.fundedAt },
                  ]}
                />
                <CommissionSplits
                  splits={funding.commission?.splits ?? []}
                  parentPoints={funding.commission?.points ?? '0'}
                  parentAmount={funding.commission?.amount ?? null}
                  readOnly
                />
              </div>
            ) : (
              <TabEmptyState
                title={t('merchant_advances.detail.funding.empty')}
                description={t('merchant_advances.detail.funding.hint')}
              />
            )}
          </TabsContent>

          <TabsContent value="renewals" className="mt-6">
            {renewals.length ? (
              <ul className="space-y-3">
                {renewals.map((renewal) => (
                  <li key={renewal.id} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <StatusBadge variant="info">{renewal.status ? t(`merchant_advances.renewal.${renewal.status}`) : '—'}</StatusBadge>
                      <span className="text-xs text-muted-foreground">{t('merchant_advances.pipeline.paidIn')}: {renewal.paidInPct ?? '0'}%</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {WRITEBACK.map((status) => (
                        <Button key={status} type="button" size="sm" variant="outline" onClick={() => void writeRenewal(renewal, status)}>
                          {t(`merchant_advances.renewal.${status}`)}
                        </Button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <TabEmptyState title={t('merchant_advances.renewals.empty.title')} description={t('merchant_advances.renewals.empty.description')} />
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <ul className="space-y-2 text-sm">
              <li>{t('merchant_advances.detail.activity.dealUpdated')}: {deal.updatedAt ?? '—'}</li>
              {offers.map((offer) => (
                <li key={offer.id}>{t('merchant_advances.detail.activity.offer')}: {offer.amount ?? '—'} ({offer.status})</li>
              ))}
              {fundings.map((row) => (
                <li key={row.id}>{t('merchant_advances.detail.activity.funded')}: {row.fundedAmount ?? '—'}</li>
              ))}
              {replies.map((reply) => (
                <li key={reply.id}>{t('merchant_advances.detail.activity.reply')}: {reply.classification}</li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </PageBody>
    </Page>
  )
}
