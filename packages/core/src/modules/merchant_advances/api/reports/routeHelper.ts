import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { hasFeature } from '@open-mercato/shared/security/features'
import type { EntityManager } from '@mikro-orm/postgresql'
import { REPORTS_VIEW_FEATURE } from '../../lib/reports/aggregates'
import { buildReportDemoFixture } from '../../lib/reports/demoFixture'
import { loadReportSnapshot } from '../../lib/reports/loadSnapshot'
import type { ReportSnapshot } from '../../lib/reports/aggregates'

export const reportsRouteMetadata = {
  GET: { requireAuth: true, requireFeatures: [REPORTS_VIEW_FEATURE] },
}

export async function resolveReportSnapshot(request: Request): Promise<
  | { ok: true; snapshot: ReportSnapshot; demo: boolean }
  | { ok: false; response: NextResponse }
> {
  const { translate } = await resolveTranslations()
  const auth = await getAuthFromRequest(request)
  if (!auth) {
    return { ok: false, response: NextResponse.json({ error: translate('merchant_advances.errors.unauthorized', 'Unauthorized') }, { status: 401 }) }
  }
  const granted = Array.isArray(auth.features) ? auth.features as string[] : null
  if (granted && !hasFeature(granted, REPORTS_VIEW_FEATURE)) {
    return { ok: false, response: NextResponse.json({ error: translate('merchant_advances.errors.reportsForbidden', 'Reports are limited to admins.') }, { status: 403 }) }
  }
  const container = await createRequestContainer()
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request })
  const organizationId = scope?.selectedId ?? auth.orgId ?? null
  const tenantId = auth.tenantId ?? null
  if (!organizationId || !tenantId) {
    return { ok: false, response: NextResponse.json({ error: translate('merchant_advances.errors.scopeMissing', 'Organization and tenant context are required.') }, { status: 400 }) }
  }
  const em = (container.resolve('em') as EntityManager).fork()
  const live = await loadReportSnapshot(em, { organizationId, tenantId })
  if (!live.deals.length) {
    return { ok: true, snapshot: buildReportDemoFixture(), demo: true }
  }
  return { ok: true, snapshot: live, demo: false }
}
