import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { aggregateFunders } from '../../../lib/reports/aggregates'
import { reportsRouteMetadata, resolveReportSnapshot } from '../routeHelper'

export const metadata = reportsRouteMetadata

export async function GET(request: Request) {
  const resolved = await resolveReportSnapshot(request)
  if (!resolved.ok) return resolved.response
  return NextResponse.json({
    demo: resolved.demo,
    rows: aggregateFunders(resolved.snapshot),
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'MCA funder analytics',
  methods: {
    GET: {
      summary: 'Submitted, approved, funded, and commission by funder',
      responses: [{ status: 200, description: 'Funder rows', schema: z.object({ demo: z.boolean(), rows: z.array(z.object({}).passthrough()) }) }],
    },
  },
}
