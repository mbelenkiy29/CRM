import { MCA_DOCUMENT_CLASSIFICATIONS, type McaDocumentClassification } from '../../data/constants'

export const INTAKE_FORM_PROVIDERS = ['jotform', 'gohighlevel', 'zoho', 'custom'] as const
export type IntakeFormProvider = (typeof INTAKE_FORM_PROVIDERS)[number]

export type IntakeMappedDeal = {
  businessName: string
  requestedAmount: string | null
  avgMonthlyRevenue: string | null
  timeInBusinessMonths: number | null
  position: number | null
  industry: string | null
  state: string | null
  ein: string | null
  legalAddress: string | null
  startDate: string | null
  ownerEmail: string | null
  ownerFirstName: string | null
  ownerLastName: string | null
  ownerPhone: string | null
  ownerUserId: string | null
  leadSourceCode: string | null
  statementUrls: string[]
  statementAttachmentIds: string[]
  applicationAttachmentIds: string[]
  provider: IntakeFormProvider
}

export type IntakeMappingErrorCode = 'business_name_required' | 'invalid_payload'

export class IntakeMappingError extends Error {
  readonly code: IntakeMappingErrorCode

  constructor(code: IntakeMappingErrorCode, message: string) {
    super(message)
    this.name = 'IntakeMappingError'
    this.code = code
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BUSINESS_NAME_ALIASES = [
  'businessname',
  'business_name',
  'company',
  'companyname',
  'company_name',
  'legalname',
  'legal_name',
  'merchantname',
  'merchant_name',
  'merchant',
  'dba',
  'doingbusinessas',
]

const REQUESTED_AMOUNT_ALIASES = [
  'requestedamount',
  'requested_amount',
  'amountrequested',
  'amount_requested',
  'fundingamount',
  'funding_amount',
  'advanceamount',
  'advance_amount',
  'requested',
]

const REVENUE_ALIASES = [
  'avgmonthlyrevenue',
  'avg_monthly_revenue',
  'averagemonthlyrevenue',
  'average_monthly_revenue',
  'monthlyrevenue',
  'monthly_revenue',
  'revenue',
  'amr',
]

const TIB_ALIASES = [
  'timeinbusinessmonths',
  'time_in_business_months',
  'timeinbusiness',
  'time_in_business',
  'monthsinbusiness',
  'months_in_business',
  'tib',
  'tibmonths',
]

const POSITION_ALIASES = ['position', 'fundingposition', 'funding_position']
const INDUSTRY_ALIASES = ['industry', 'naics', 'sic']
const STATE_ALIASES = ['state', 'merchantstate', 'merchant_state', 'region']
const EIN_ALIASES = ['ein', 'fein', 'taxid', 'tax_id']
const ADDRESS_ALIASES = ['legaladdress', 'legal_address', 'address', 'businessaddress', 'business_address']
const START_DATE_ALIASES = ['startdate', 'start_date', 'opendate', 'open_date', 'established']
const OWNER_EMAIL_ALIASES = ['owneremail', 'owner_email', 'email', 'contactemail', 'contact_email', 'primaryemail']
const OWNER_FIRST_ALIASES = ['ownerfirstname', 'owner_first_name', 'firstname', 'first_name']
const OWNER_LAST_ALIASES = ['ownerlastname', 'owner_last_name', 'lastname', 'last_name']
const OWNER_PHONE_ALIASES = ['ownerphone', 'owner_phone', 'phone', 'mobile', 'primaryphone']
const OWNER_USER_ALIASES = ['owneruserid', 'owner_user_id', 'assignedto', 'assigned_to', 'assignee', 'ownerid']
const LEAD_SOURCE_ALIASES = ['leadsource', 'lead_source', 'source', 'leadsourcecode', 'lead_source_code']

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function stripJotformPrefix(key: string): string {
  return key.replace(/^q\d+_/i, '')
}

function asText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) {
    const parts = value.map((item) => asText(item)).filter((item): item is string => Boolean(item))
    return parts.length ? parts.join(' ') : null
  }
  if (isRecord(value)) {
    const preferred = asText(value.full) ?? asText(value.text) ?? asText(value.value) ?? asText(value.name)
    if (preferred) return preferred
    const first = asText(value.first)
    const last = asText(value.last)
    if (first || last) return [first, last].filter(Boolean).join(' ')
    const line1 = asText(value.addr_line1) ?? asText(value.addressLine1) ?? asText(value.line1)
    const city = asText(value.city)
    const state = asText(value.state)
    if (line1 || city || state) return [line1, city, state].filter(Boolean).join(', ')
  }
  return null
}

function asMoney(value: unknown): string | null {
  const text = asText(value)
  if (!text) return null
  const cleaned = text.replace(/[$,\s]/g, '')
  if (!cleaned) return null
  const numeric = Number(cleaned)
  return Number.isFinite(numeric) ? cleaned : null
}

function asMonths(value: unknown): number | null {
  const text = asText(value)
  if (!text) return null
  const yearMatch = text.match(/^(\d+(?:\.\d+)?)\s*(years?|yrs?)$/i)
  if (yearMatch) {
    const years = Number(yearMatch[1])
    return Number.isFinite(years) ? Math.round(years * 12) : null
  }
  const numeric = Number(text.replace(/[^\d.]/g, ''))
  if (!Number.isFinite(numeric)) return null
  const months = Math.round(numeric)
  if (months < 0 || months > 1200) return null
  return months
}

function asInt(value: unknown, min: number, max: number): number | null {
  const text = asText(value)
  if (!text) return null
  const numeric = Number(text)
  if (!Number.isInteger(numeric) && !Number.isFinite(numeric)) return null
  const parsed = Math.round(numeric)
  if (parsed < min || parsed > max) return null
  return parsed
}

function asUuid(value: unknown): string | null {
  const text = asText(value)
  return text && UUID_RE.test(text) ? text : null
}

function asEmail(value: unknown): string | null {
  const text = asText(value)
  if (!text || !text.includes('@')) return null
  return text
}

function flattenRecord(input: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [rawKey, value] of Object.entries(input)) {
    const key = prefix ? `${prefix}_${rawKey}` : rawKey
    out[key] = value
    out[stripJotformPrefix(rawKey)] = value
    if (isRecord(value) && !Array.isArray(value)) {
      Object.assign(out, flattenRecord(value, key))
    }
  }
  return out
}

function lookup(fields: Record<string, unknown>, aliases: readonly string[]): unknown {
  const normalized = new Map<string, unknown>()
  for (const [key, value] of Object.entries(fields)) {
    normalized.set(normalizeKey(stripJotformPrefix(key)), value)
    normalized.set(normalizeKey(key), value)
  }
  for (const alias of aliases) {
    const match = normalized.get(normalizeKey(alias))
    if (match !== undefined && match !== null && match !== '') return match
  }
  return undefined
}

function collectUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectUrls(item))
  }
  const text = asText(value)
  if (!text) return []
  if (/^https?:\/\//i.test(text)) return [text]
  return text
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter((part) => /^https?:\/\//i.test(part))
}

function collectUuids(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asUuid(item)).filter((item): item is string => Boolean(item))
  }
  const single = asUuid(value)
  return single ? [single] : []
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function ghlCustomFields(contact: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  const collections = [contact.customFields, contact.customData, contact.custom_fields]
  for (const collection of collections) {
    if (Array.isArray(collection)) {
      for (const item of collection) {
        if (!isRecord(item)) continue
        const key = asText(item.fieldKey) ?? asText(item.key) ?? asText(item.id)
        if (key) fields[key] = item.value ?? item.field_value
      }
    } else if (isRecord(collection)) {
      Object.assign(fields, collection)
    }
  }
  return fields
}

function extractJotform(body: Record<string, unknown>): Record<string, unknown> {
  const raw = parseJsonRecord(body.rawRequest) ?? {}
  return { ...flattenRecord(raw), ...flattenRecord(body) }
}

function extractGhl(body: Record<string, unknown>): Record<string, unknown> {
  const contact = isRecord(body.contact) ? body.contact : body
  return {
    ...flattenRecord(body),
    ...flattenRecord(contact),
    ...ghlCustomFields(contact),
    companyName: contact.companyName ?? contact.company_name ?? body.companyName,
    email: contact.email ?? body.email,
    firstName: contact.firstName ?? contact.first_name ?? body.firstName,
    lastName: contact.lastName ?? contact.last_name ?? body.lastName,
    phone: contact.phone ?? contact.mobile ?? body.phone,
  }
}

function extractZoho(body: Record<string, unknown>): Record<string, unknown> {
  const firstRow = Array.isArray(body.data) && isRecord(body.data[0]) ? body.data[0] : body
  return { ...flattenRecord(body), ...flattenRecord(firstRow) }
}

export function detectIntakeProvider(body: unknown): IntakeFormProvider {
  if (!isRecord(body)) return 'custom'
  const explicit = asText(body.provider) ?? asText(body.source)
  if (explicit) {
    const normalized = normalizeKey(explicit)
    if (normalized === 'jotform') return 'jotform'
    if (normalized === 'gohighlevel' || normalized === 'ghl') return 'gohighlevel'
    if (normalized === 'zoho') return 'zoho'
    if (normalized === 'custom') return 'custom'
  }
  if (body.formID !== undefined || body.submissionID !== undefined || body.rawRequest !== undefined) return 'jotform'
  if (body.locationId !== undefined || body.location_id !== undefined || isRecord(body.contact)) return 'gohighlevel'
  if (body.module !== undefined || (Array.isArray(body.data) && body.ids !== undefined)) return 'zoho'
  return 'custom'
}

function mapFlatFields(fields: Record<string, unknown>, provider: IntakeFormProvider): IntakeMappedDeal {
  const businessName = asText(lookup(fields, BUSINESS_NAME_ALIASES))
  if (!businessName) {
    throw new IntakeMappingError('business_name_required', '[internal] MCA intake requires businessName')
  }
  const statementUrls = [
    ...collectUrls(lookup(fields, ['statementurls', 'statement_urls', 'statements', 'bankstatements'])),
    ...collectUrls(fields.statementUrls),
    ...collectUrls(fields.statement_urls),
  ]
  const statementAttachmentIds = [
    ...collectUuids(lookup(fields, ['statementattachmentids', 'statement_attachment_ids'])),
    ...collectUuids(fields.statementAttachmentIds),
  ]
  const applicationAttachmentIds = [
    ...collectUuids(lookup(fields, ['applicationattachmentids', 'application_attachment_ids'])),
    ...collectUuids(fields.applicationAttachmentIds),
  ]
  return {
    businessName,
    requestedAmount: asMoney(lookup(fields, REQUESTED_AMOUNT_ALIASES)),
    avgMonthlyRevenue: asMoney(lookup(fields, REVENUE_ALIASES)),
    timeInBusinessMonths: asMonths(lookup(fields, TIB_ALIASES)),
    position: asInt(lookup(fields, POSITION_ALIASES), 1, 20),
    industry: asText(lookup(fields, INDUSTRY_ALIASES)),
    state: asText(lookup(fields, STATE_ALIASES)),
    ein: asText(lookup(fields, EIN_ALIASES)),
    legalAddress: asText(lookup(fields, ADDRESS_ALIASES)),
    startDate: asText(lookup(fields, START_DATE_ALIASES)),
    ownerEmail: asEmail(lookup(fields, OWNER_EMAIL_ALIASES)),
    ownerFirstName: asText(lookup(fields, OWNER_FIRST_ALIASES)),
    ownerLastName: asText(lookup(fields, OWNER_LAST_ALIASES)),
    ownerPhone: asText(lookup(fields, OWNER_PHONE_ALIASES)),
    ownerUserId: asUuid(lookup(fields, OWNER_USER_ALIASES)),
    leadSourceCode: asText(lookup(fields, LEAD_SOURCE_ALIASES)),
    statementUrls: Array.from(new Set(statementUrls)),
    statementAttachmentIds: Array.from(new Set(statementAttachmentIds)),
    applicationAttachmentIds: Array.from(new Set(applicationAttachmentIds)),
    provider,
  }
}

export function mapFormPayload(
  provider: IntakeFormProvider | 'auto' | undefined,
  body: unknown,
): IntakeMappedDeal {
  if (!isRecord(body)) {
    throw new IntakeMappingError('invalid_payload', '[internal] MCA intake payload must be an object')
  }
  const resolved = !provider || provider === 'auto' ? detectIntakeProvider(body) : provider
  if (resolved === 'jotform') return mapFlatFields(extractJotform(body), 'jotform')
  if (resolved === 'gohighlevel') return mapFlatFields(extractGhl(body), 'gohighlevel')
  if (resolved === 'zoho') return mapFlatFields(extractZoho(body), 'zoho')
  return mapFlatFields(flattenRecord(body), 'custom')
}

export function isDocumentClassification(value: string): value is McaDocumentClassification {
  return (MCA_DOCUMENT_CLASSIFICATIONS as readonly string[]).includes(value)
}
