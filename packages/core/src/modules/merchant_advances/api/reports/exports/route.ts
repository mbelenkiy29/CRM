import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { toCsv } from '../../../lib/reports/ssn'
import { reportsRouteMetadata, resolveReportSnapshot } from '../routeHelper'

export const metadata = reportsRouteMetadata

export async function GET(request: Request) {
  const resolved = await resolveReportSnapshot(request)
  if (!resolved.ok) return resolved.response
  const url = new URL(request.url)
  const kind = url.searchParams.get('kind') === 'funded' ? 'funded' : 'deals'
  const fundedIds = new Set(resolved.snapshot.fundings.map((row) => row.dealId))
  const rows = resolved.snapshot.deals.filter((deal) => kind === 'deals' || fundedIds.has(deal.id) || deal.pipelineStatus === 'funded')
  const csv = toCsv(
    ['dealId', 'ownerUserId', 'pipelineStatus', 'requestedAmount'],
    rows.map((deal) => [deal.id, deal.ownerUserId, deal.pipelineStatus, deal.requestedAmount]),
  )
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="mca-${kind}.csv"`,
    },
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'MCA report CSV export',
  methods: {
    GET: {
      summary: 'Export deals or funded deals. SSN-shaped values are stripped.',
      query: z.object({ kind: z.enum(['deals', 'funded']).optional() }),
      responses: [{ status: 200, description: 'CSV' }],
    },
  },
}
