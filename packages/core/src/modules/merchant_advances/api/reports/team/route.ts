import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { aggregateTeam } from '../../../lib/reports/aggregates'
import { reportsRouteMetadata, resolveReportSnapshot } from '../routeHelper'

export const metadata = reportsRouteMetadata

export async function GET(request: Request) {
  const resolved = await resolveReportSnapshot(request)
  if (!resolved.ok) return resolved.response
  return NextResponse.json({
    demo: resolved.demo,
    ...aggregateTeam(resolved.snapshot),
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'MCA team performance',
  methods: {
    GET: {
      summary: 'Stage output, payments, and profit by user',
      responses: [{ status: 200, description: 'Team totals', schema: z.object({ demo: z.boolean() }).passthrough() }],
    },
  },
}
