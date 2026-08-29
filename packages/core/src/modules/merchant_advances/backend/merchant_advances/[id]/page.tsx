"use client"

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import {
  DetailFieldsSection,
  ErrorMessage,
  LoadingMessage,
  RecordNotFoundState,
  TabEmptyState,
} from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
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

function stipLines(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.filter((item): item is string => typeof item === 'string').join('\n')
}

export default function MerchantAdvancesDealDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
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

  const { runMutation, retryLastMutation } = useGuardedMutation({
    contextId: `merchant-advances-deal-${id}`,
    blockedMessage: t('merchant_advances.errors.saveBlocked'),
  })
  const mutationContext = React.useMemo(() => ({
    formId: `merchant-advances-deal-${id}`,
    resourceKind: 'merchant_advances.deal',
    resourceId: id,
    retryLastMutation,
  }), [id, retryLastMutation])

  const funderName = React.useCallback((funderId: string | null) => {
    if (!funderId) return '—'
    return funders.find((funder) => funder.id === funderId)?.name ?? funderId
  }, [funders])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(false)
    setNotFound(false)
    try {
      const [dealsRes, offersRes, submissionsRes, repliesRes, fundingsRes, renewalsRes, fundersRes] = await Promise.all([
        readApiResultOrThrow<ListResponse<Deal>>(`/api/merchant_advances/deals?id=${id}&pageSize=1`),
        readApiResultOrThrow<ListResponse<Offer>>(`/api/merchant_advances/offers?dealId=${id}&pageSize=100`),
        readApiResultOrThrow<ListResponse<Submission>>(`/api/merchant_advances/submissions?dealId=${id}&pageSize=100`),
        readApiResultOrThrow<ListResponse<Reply>>(`/api/merchant_advances/replies?dealId=${id}&pageSize=100`),
        readApiResultOrThrow<ListResponse<Funding>>(`/api/merchant_advances/fundings?dealId=${id}&pageSize=100`),
        readApiResultOrThrow<ListResponse<Renewal>>(`/api/merchant_advances/renewals?dealId=${id}&pageSize=100`),
        readApiResultOrThrow<ListResponse<Funder>>('/api/merchant_advances/funders?pageSize=100'),
      ])
      const nextDeal = asList<Deal>(dealsRes)[0] ?? null
      if (!nextDeal) {
        setNotFound(true)
        setDeal(null)
        return
      }
      setDeal(nextDeal)
      setOffers(asList<Offer>(offersRes))
      setSubmissions(asList<Submission>(submissionsRes))
      setReplies(asList<Reply>(repliesRes))
      setFundings(asList<Funding>(fundingsRes))
      setRenewals(asList<Renewal>(renewalsRes))
      setFunders(asList<Funder>(fundersRes))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    void load()
  }, [load])

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

  const writeRenewal = async (renewal: Renewal, status: string) => {
    await runDealWrite(async () => {
      await withScopedApiRequestHeaders(
        buildOptimisticLockHeader(renewal.updatedAt),
        () => updateCrud('merchant_advances/renewals', { id: renewal.id, status }),
      )
    }, 'merchant_advances.detail.renewalUpdated')
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
            <DetailFieldsSection
              fields={[
                { label: t('merchant_advances.deals.fields.businessName'), value: deal.businessName },
                { label: t('merchant_advances.deals.fields.requestedAmount'), value: deal.requestedAmount },
                { label: t('merchant_advances.deals.fields.avgMonthlyRevenue'), value: deal.avgMonthlyRevenue },
                { label: t('merchant_advances.deals.fields.timeInBusinessMonths'), value: deal.timeInBusinessMonths },
                { label: t('merchant_advances.deals.fields.position'), value: deal.position },
                { label: t('merchant_advances.deals.fields.industry'), value: deal.industry },
                { label: t('merchant_advances.deals.fields.state'), value: deal.state },
              ]}
            />
          </TabsContent>

          <TabsContent value="statements" className="mt-6">
            <TabEmptyState
              title={t('merchant_advances.detail.statements.empty')}
              description={t('merchant_advances.detail.statements.hint')}
            />
          </TabsContent>

          <TabsContent value="matches" className="mt-6">
            <TabEmptyState
              title={t('merchant_advances.detail.matches.empty')}
              description={t('merchant_advances.detail.matches.hint')}
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
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="py-2">{funderName(row.funderId)}</td>
                      <td className="py-2">{row.method ? t(`merchant_advances.method.${row.method}`) : '—'}</td>
                      <td className="py-2">{row.status ?? '—'}</td>
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
                  </li>
                ))}
              </ul>
            ) : (
              <TabEmptyState title={t('merchant_advances.detail.replies.empty')} />
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
                <DetailFieldsSection
                  fields={[
                    { label: t('merchant_advances.funding.fundedAmount'), value: funding.fundedAmount },
                    { label: t('merchant_advances.funding.payback'), value: funding.paybackAmount },
                    { label: t('merchant_advances.funding.payment'), value: funding.paymentAmount },
                    { label: t('merchant_advances.pipeline.paidIn'), value: funding.paidInPct },
                    { label: t('merchant_advances.funding.fundedAt'), value: funding.fundedAt },
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
