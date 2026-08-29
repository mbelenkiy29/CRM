"use client"

import * as React from 'react'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { BarChart, KpiCard } from '@open-mercato/ui/backend/charts'
import { EmptyState } from '@open-mercato/ui/backend/EmptyState'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type RepRow = {
  ownerUserId: string
  dealsIn: number
  submitted: number
  approved: number
  funded: number
  fundedAmount: string
  distributions: string
  conversionPct: string
}

type TeamPayload = {
  demo?: boolean
  stages?: Array<{ stage: string; count: number }>
  payments?: string
  distributions?: string
  profitByUser?: Array<{ ownerUserId: string; profit: string }>
}

type FunderRow = {
  funderId: string
  submitted: number
  approved: number
  funded: number
  fundedAmount: string
  commissions: string
}

type LeadRow = {
  key: string
  name: string
  deals: number
  funded: number
  conversionPct: string
  avgCommission: string
  cac: string
  roi: string
  costPerFunded: string
}

export default function MerchantAdvancesReportsPage() {
  const t = useT()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  const [forbidden, setForbidden] = React.useState(false)
  const [demo, setDemo] = React.useState(false)
  const [reps, setReps] = React.useState<RepRow[]>([])
  const [team, setTeam] = React.useState<TeamPayload>({})
  const [funders, setFunders] = React.useState<FunderRow[]>([])
  const [leads, setLeads] = React.useState<LeadRow[]>([])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [repRes, teamRes, funderRes, leadRes] = await Promise.all([
        apiCall<{ demo?: boolean; rows?: RepRow[] }>('/api/merchant_advances/reports/rep'),
        apiCall<TeamPayload>('/api/merchant_advances/reports/team'),
        apiCall<{ rows?: FunderRow[] }>('/api/merchant_advances/reports/funders'),
        apiCall<{ rows?: LeadRow[] }>('/api/merchant_advances/reports/leads'),
      ])
      if (cancelled) return
      if ([repRes, teamRes, funderRes, leadRes].some((result) => result.status === 403)) {
        setForbidden(true)
        setLoading(false)
        return
      }
      if (![repRes, teamRes, funderRes, leadRes].every((result) => result.ok)) {
        setError(true)
        setLoading(false)
        return
      }
      setDemo(Boolean(repRes.result?.demo || teamRes.result?.demo))
      setReps(repRes.result?.rows ?? [])
      setTeam(teamRes.result ?? {})
      setFunders(funderRes.result?.rows ?? [])
      setLeads(leadRes.result?.rows ?? [])
      setLoading(false)
    })().catch(() => {
      if (!cancelled) {
        setError(true)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const exportCsv = async (kind: 'deals' | 'funded') => {
    const result = await apiCall<Blob>(`/api/merchant_advances/reports/exports?kind=${kind}`, undefined, {
      parse: (response) => response.blob(),
    })
    if (!result.ok || !result.result) return
    const url = URL.createObjectURL(result.result)
    const link = document.createElement('a')
    link.href = url
    link.download = `mca-${kind}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <Page><PageBody><LoadingMessage label={t('merchant_advances.common.loading')} /></PageBody></Page>
  }
  if (forbidden) {
    return (
      <Page>
        <PageBody>
          <EmptyState
            title={t('merchant_advances.reports.title')}
            description={t('merchant_advances.reports.restricted')}
          />
        </PageBody>
      </Page>
    )
  }
  if (error) {
    return <Page><PageBody><ErrorMessage label={t('merchant_advances.reports.loadError')} /></PageBody></Page>
  }

  const fundedTotal = reps.reduce((sum, row) => sum + Number(row.fundedAmount || 0), 0)
  const dealCount = reps.reduce((sum, row) => sum + row.dealsIn, 0)

  return (
    <Page>
      <PageHeader
        title={t('merchant_advances.reports.title')}
        description={demo ? t('merchant_advances.reports.demo') : t('merchant_advances.reports.restricted')}
      />
      <PageBody>
        <div className="mb-6 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void exportCsv('deals')}>
            {t('merchant_advances.reports.exportDeals')}
          </Button>
          <Button type="button" variant="outline" onClick={() => void exportCsv('funded')}>
            {t('merchant_advances.reports.exportFunded')}
          </Button>
        </div>
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <KpiCard title={t('merchant_advances.reports.kpi.deals')} value={dealCount} />
          <KpiCard title={t('merchant_advances.reports.kpi.fundedAmount')} value={fundedTotal} />
          <KpiCard title={t('merchant_advances.reports.kpi.distributions')} value={Number(team.distributions ?? 0)} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <BarChart
            title={t('merchant_advances.reports.team')}
            data={(team.stages ?? []).map((row) => ({ stage: row.stage, count: row.count }))}
            index="stage"
            categories={['count']}
            emptyMessage={t('merchant_advances.reports.empty')}
          />
          <BarChart
            title={t('merchant_advances.reports.rep')}
            data={reps.map((row) => ({ rep: row.ownerUserId.slice(0, 8), funded: Number(row.fundedAmount) }))}
            index="rep"
            categories={['funded']}
            emptyMessage={t('merchant_advances.reports.empty')}
          />
          <BarChart
            title={t('merchant_advances.reports.funder')}
            data={funders.map((row) => ({ funder: row.funderId.slice(0, 8), funded: Number(row.fundedAmount) }))}
            index="funder"
            categories={['funded']}
            emptyMessage={t('merchant_advances.reports.empty')}
          />
          <BarChart
            title={t('merchant_advances.reports.leads')}
            data={leads.map((row) => ({ source: row.name, deals: row.deals, funded: row.funded }))}
            index="source"
            categories={['deals', 'funded']}
            emptyMessage={t('merchant_advances.reports.empty')}
          />
        </div>
      </PageBody>
    </Page>
  )
}
