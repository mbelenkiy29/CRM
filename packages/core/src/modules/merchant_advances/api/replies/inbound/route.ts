import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { EntityManager } from '@mikro-orm/postgresql'
import { replyInboundSchema, type ReplyInboundInput } from '../../../data/validators'
import { ingestInboundReply } from '../../../lib/replies/ingest'
import { inboundReplySecret, verifyInboundSignature } from '../../../lib/replies/signature'

export const metadata = {
  POST: { requireAuth: false },
}

export async function POST(request: Request) {
  const { translate } = await resolveTranslations()
  const rawBody = await request.text()
  try {
    const auth = await getAuthFromRequest(request)
    const signed = verifyInboundSignature(
      rawBody,
      request.headers.get('webhook-signature'),
      inboundReplySecret(),
    )
    if (!auth && !signed) {
      return NextResponse.json({ error: translate('merchant_advances.errors.unauthorized', 'Unauthorized') }, { status: 401 })
    }

    let parsedJson: unknown = {}
    try {
      parsedJson = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      return NextResponse.json({ error: '[internal] invalid inbound JSON' }, { status: 400 })
    }
    const body = parsedJson && typeof parsedJson === 'object' ? parsedJson as Record<string, unknown> : {}

    if (auth) {
      const container = await createRequestContainer()
      const scope = await resolveOrganizationScopeForRequest({ container, auth, request })
      const ctx: CommandRuntimeContext = {
        container,
        auth,
        organizationScope: scope,
        selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
        organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
        request,
      }
      const scoped = withScopedPayload(body, ctx, translate, {
        messages: {
          tenantRequired: { key: 'merchant_advances.errors.scopeMissing', fallback: 'Tenant context is required.' },
          organizationRequired: { key: 'merchant_advances.errors.scopeMissing', fallback: 'Organization context is required.' },
        },
      })
      const input = replyInboundSchema.parse({
        ...scoped,
        organizationId: ctx.selectedOrganizationId,
        tenantId: auth.tenantId,
      })
      const commandBus = container.resolve('commandBus') as CommandBus
      const { result } = await commandBus.execute<ReplyInboundInput, Awaited<ReturnType<typeof ingestInboundReply>>>(
        'merchant_advances.replies.ingest',
        { input, ctx },
      )
      return NextResponse.json(result)
    }

    const input = replyInboundSchema.parse(body)
    if (!input.organizationId || !input.tenantId) {
      return NextResponse.json({ error: translate('merchant_advances.errors.scopeMissing', 'Organization and tenant context are required.') }, { status: 400 })
    }
    const container = await createRequestContainer()
    const em = (container.resolve('em') as EntityManager).fork()
    const result = await ingestInboundReply(em, {
      ...input,
      organizationId: input.organizationId,
      tenantId: input.tenantId,
    })
    if (result.unmatched) {
      return NextResponse.json({
        error: translate('merchant_advances.errors.unmatchedReply', 'Inbound reply did not match a recent submission.'),
      }, { status: 422 })
    }
    return NextResponse.json(result)
  } catch (error) {
    if (isCrudHttpError(error) || error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    throw error
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Ingest a signed funder reply',
  methods: {
    POST: {
      summary: 'Parse an inbound funder email or structured status webhook',
      description: 'Classifies offer, decline, stip, or unknown. Never sends submissions. Structured status skips email heuristics.',
      requestBody: { contentType: 'application/json', schema: replyInboundSchema },
      responses: [
        {
          status: 200,
          description: 'Reply stored and matched',
          schema: z.object({
            replyId: z.string().uuid(),
            dealId: z.string().uuid(),
            submissionId: z.string().uuid().nullable(),
            classification: z.string(),
            offerId: z.string().uuid().nullable(),
            unmatched: z.literal(false),
          }),
        },
      ],
    },
  },
}
