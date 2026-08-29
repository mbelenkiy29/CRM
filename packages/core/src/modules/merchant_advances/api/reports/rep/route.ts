import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { aggregateReps } from '../../../lib/reports/aggregates'
import { reportsRouteMetadata, resolveReportSnapshot } from '../routeHelper'

export const metadata = reportsRouteMetadata

export async function GET(request: Request) {
  const resolved = await resolveReportSnapshot(request)
  if (!resolved.ok) return resolved.response
  return NextResponse.json({
    demo: resolved.demo,
    rows: aggregateReps(resolved.snapshot),
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'MCA rep performance',
  methods: {
    GET: {
      summary: 'Rep deals, conversion, and distributions',
      responses: [{ status: 200, description: 'Rep rows', schema: z.object({ demo: z.boolean(), rows: z.array(z.object({}).passthrough()) }) }],
    },
  },
}
