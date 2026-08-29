import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { matchRefreshSchema, type MatchRefreshInput } from '../../../data/validators'
import { toRecord } from '../../../lib/crudScope'

const routeMetadata = {
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.match.manage'] },
}

export const metadata = routeMetadata

export async function POST(request: Request) {
  const { translate } = await resolveTranslations()
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(request)
    if (!auth) {
      return NextResponse.json({ error: translate('merchant_advances.errors.unauthorized', 'Unauthorized') }, { status: 401 })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request })
    const ctx: CommandRuntimeContext = {
      container,
      auth,
      organizationScope: scope,
      selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
      organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
      request,
    }
    const body = toRecord(await readJsonSafe(request, {}))
    const scoped = withScopedPayload(body, ctx, translate, {
      messages: {
        tenantRequired: { key: 'merchant_advances.errors.scopeMissing', fallback: 'Tenant context is required.' },
        organizationRequired: { key: 'merchant_advances.errors.scopeMissing', fallback: 'Organization context is required.' },
      },
    })
    const input = matchRefreshSchema.parse({
      ...scoped,
      organizationId: ctx.selectedOrganizationId,
      tenantId: auth.tenantId,
    })
    const commandBus = container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<MatchRefreshInput, { dealId: string; matchCount: number; topScore: string | null }>(
      'merchant_advances.matches.refresh',
      { input, ctx },
    )
    return NextResponse.json(result)
  } catch (error) {
    if (isCrudHttpError(error)) {
      return NextResponse.json(error.body, { status: error.status })
    }
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    throw error
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Refresh MCA funder matches',
  methods: {
    POST: {
      summary: 'Re-score active funders for a deal',
      description: 'Writes ranked mca_funder_matches. Never submits to funders.',
      requestBody: {
        contentType: 'application/json',
        schema: matchRefreshSchema,
      },
      responses: [
        {
          status: 200,
          description: 'Ranked matches written',
          schema: z.object({
            dealId: z.string().uuid(),
            matchCount: z.number(),
            topScore: z.string().nullable(),
          }),
        },
      ],
    },
  },
}
