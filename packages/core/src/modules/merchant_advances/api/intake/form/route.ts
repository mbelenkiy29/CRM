import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { MCA_DEAL_RESOURCE_KIND } from '../../../commands/intake'
import { loadIntakeWebhookSecret } from '../../../commands/settings'
import { intakeFormSchema } from '../../../data/validators'
import { executeDealIntake } from '../../../lib/intake/executeIntake'
import { IntakeMappingError, INTAKE_FORM_PROVIDERS, mapFormPayload } from '../../../lib/intake/formMapper'
import { secretsMatch } from '../../../lib/intake/uploadLinks'
import { isWebhooksModuleEnabled } from '../../../lib/intake/webhooksEnabled'
import { toRecord } from '../../../lib/crudScope'

const logger = createLogger('merchant_advances').child({ route: 'intake-form' })
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const metadata = {
  POST: { requireAuth: false },
}

function readHeader(req: Request, name: string): string | null {
  return req.headers.get(name)
}

function readUuid(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value && UUID_RE.test(value)) return value
  }
  return null
}

function providerFromRequest(req: Request, body: Record<string, unknown>): (typeof INTAKE_FORM_PROVIDERS)[number] | 'auto' {
  const url = new URL(req.url)
  const queryProvider = url.searchParams.get('provider')
  const raw = queryProvider ?? (typeof body.provider === 'string' ? body.provider : null)
  if (raw && (INTAKE_FORM_PROVIDERS as readonly string[]).includes(raw)) {
    return raw as (typeof INTAKE_FORM_PROVIDERS)[number]
  }
  return 'auto'
}

export async function POST(req: Request): Promise<Response> {
  const { translate } = await resolveTranslations()
  if (!isWebhooksModuleEnabled()) {
    return NextResponse.json(
      { error: translate('merchant_advances.errors.webhooksDisabled', 'Form intake is unavailable because webhooks are disabled.') },
      { status: 404 },
    )
  }

  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    const body = toRecord(await readJsonSafe(req, {}))
    intakeFormSchema.parse(body)
    const mapped = mapFormPayload(providerFromRequest(req, body), body)
    const url = new URL(req.url)
    const organizationId = readUuid(
      url.searchParams.get('organizationId'),
      readHeader(req, 'x-om-organization-id'),
      typeof body.organizationId === 'string' ? body.organizationId : null,
      auth?.orgId,
    )
    const tenantId = readUuid(
      url.searchParams.get('tenantId'),
      readHeader(req, 'x-om-tenant-id'),
      typeof body.tenantId === 'string' ? body.tenantId : null,
      auth?.tenantId,
    )
    if (!organizationId || !tenantId) {
      throw new CrudHttpError(400, {
        error: translate('merchant_advances.errors.scopeRequired', 'Tenant and organization are required for intake.'),
      })
    }

    const configuredSecret = await loadIntakeWebhookSecret(container, { tenantId, organizationId })
    const providedSecret = readHeader(req, 'x-mca-intake-secret') ?? readHeader(req, 'x-webhook-secret')
    const authenticated = Boolean(auth?.sub && auth.tenantId)
    if (!authenticated) {
      if (!configuredSecret || !providedSecret || !secretsMatch(configuredSecret, providedSecret)) {
        throw new CrudHttpError(401, {
          error: translate('merchant_advances.errors.intakeUnauthorized', 'Intake webhook secret is missing or invalid.'),
        })
      }
    }

    const scope = auth
      ? await resolveOrganizationScopeForRequest({ container, auth, request: req })
      : null
    const ctx: CommandRuntimeContext = {
      container,
      auth,
      organizationScope: scope,
      selectedOrganizationId: organizationId,
      organizationIds: scope?.filterIds ?? [organizationId],
      request: req,
    }

    if (auth?.sub) {
      const guarded = await runRouteMutationGuards({
        container,
        req,
        auth: { userId: auth.sub, tenantId, organizationId },
        input: {
          resourceKind: MCA_DEAL_RESOURCE_KIND,
          resourceId: null,
          operation: 'create',
          mutationPayload: { businessName: mapped.businessName, provider: mapped.provider },
        },
      })
      if (!guarded.ok) return guarded.response
    }

    const commandBus = container.resolve('commandBus') as CommandBus
    const result = await executeDealIntake({
      commandBus,
      ctx,
      commandInput: {
        organizationId,
        tenantId,
        businessName: mapped.businessName,
        requestedAmount: mapped.requestedAmount,
        avgMonthlyRevenue: mapped.avgMonthlyRevenue,
        timeInBusinessMonths: mapped.timeInBusinessMonths,
        position: mapped.position,
        industry: mapped.industry,
        state: mapped.state,
        ein: mapped.ein,
        legalAddress: mapped.legalAddress,
        startDate: mapped.startDate,
        ownerUserId: mapped.ownerUserId,
        ownerEmail: mapped.ownerEmail,
        ownerFirstName: mapped.ownerFirstName,
        ownerLastName: mapped.ownerLastName,
        ownerPhone: mapped.ownerPhone,
        leadSourceCode: mapped.leadSourceCode,
        statementUrls: mapped.statementUrls,
        statementAttachmentIds: mapped.statementAttachmentIds,
        applicationAttachmentIds: mapped.applicationAttachmentIds,
        assignmentMethod: mapped.ownerUserId ? 'form_rule' : 'round_robin',
        provider: mapped.provider,
      },
    })

    return NextResponse.json({
      ok: true,
      result: {
        id: result.dealId,
        dealId: result.dealId,
        ownerUserId: result.ownerUserId,
        assignmentMethod: result.assignmentMethod,
        merchantCompanyId: result.merchantCompanyId,
        primaryPersonId: result.primaryPersonId,
        documentIds: result.documentIds,
        statementUrls: result.statementUrls,
        pipelineStatus: result.pipelineStatus,
        uploadToken: result.uploadToken,
        uploadExpiresAt: result.uploadExpiresAt,
        updatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    if (err instanceof IntakeMappingError) {
      const key = err.code === 'business_name_required'
        ? 'merchant_advances.errors.businessNameRequired'
        : 'merchant_advances.errors.invalidIntake'
      return NextResponse.json(
        { error: translate(key, err.code === 'business_name_required' ? 'Business name is required.' : 'Intake payload is invalid.') },
        { status: 400 },
      )
    }
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: translate('merchant_advances.errors.invalidIntake', 'Intake payload is invalid.') },
        { status: 400 },
      )
    }
    logger.error('MCA form intake failed', { err })
    return NextResponse.json(
      { error: translate('merchant_advances.errors.intakeFailed', 'Failed to create the MCA application.') },
      { status: 500 },
    )
  }
}

const resultSchema = z.object({
  id: z.string().uuid(),
  dealId: z.string().uuid(),
  ownerUserId: z.string().uuid().nullable(),
  assignmentMethod: z.string(),
  uploadToken: z.string().nullable(),
  uploadExpiresAt: z.string().nullable(),
}).passthrough()

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Create an MCA deal from a JotForm, GoHighLevel, Zoho, or custom form webhook',
  methods: {
    POST: {
      summary: 'Create an MCA deal from a JotForm, GoHighLevel, Zoho, or custom form webhook',
      requestBody: {
        schema: z.object({
          provider: z.enum(INTAKE_FORM_PROVIDERS).optional(),
          businessName: z.string().optional(),
        }).passthrough(),
      },
      responses: [
        { status: 200, description: 'Deal created from the inbound form.', schema: z.object({ ok: z.literal(true), result: resultSchema }) },
        { status: 401, description: 'Missing or invalid intake secret.' },
        { status: 404, description: 'Webhooks module is disabled.' },
      ],
    },
  },
}
