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
import { submitSendSchema, type SubmitSendInput } from '../../../data/validators'
import { toRecord } from '../../../lib/crudScope'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.submission.send'] },
}

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
    const input = submitSendSchema.parse({
      ...scoped,
      organizationId: ctx.selectedOrganizationId,
      tenantId: auth.tenantId,
    })
    const commandBus = container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<SubmitSendInput, { dealId: string; results: unknown[] }>(
      'merchant_advances.submissions.send',
      { input, ctx },
    )
    const blocked = Array.isArray(result.results)
      && result.results.some((row) => row && typeof row === 'object' && (row as { error?: string }).error === 'duplicate_funder_submission')
    return NextResponse.json(result, { status: blocked ? 409 : 200 })
  } catch (error) {
    if (isCrudHttpError(error) || error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    throw error
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Submit an MCA deal to selected funders',
  methods: {
    POST: {
      summary: 'Create one submission per selected funder',
      description: 'Never auto-picks funders. Validation errors stay on that funder. Live API adapters are deferred.',
      requestBody: { contentType: 'application/json', schema: submitSendSchema },
      responses: [
        {
          status: 200,
          description: 'Submissions written',
          schema: z.object({
            dealId: z.string().uuid(),
            results: z.array(z.object({
              funderId: z.string().uuid(),
              submissionId: z.string().uuid().nullable(),
              status: z.string().nullable(),
              error: z.string().nullable(),
            })),
          }),
        },
      ],
    },
  },
}
