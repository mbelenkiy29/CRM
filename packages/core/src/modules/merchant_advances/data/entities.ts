import { OptionalProps } from '@mikro-orm/core'
import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import type {
  McaAssignmentMethod,
  McaDocumentClassification,
  McaOfferStatus,
  McaPaymentFrequency,
  McaPipelineStatus,
  McaRenewalStatus,
  McaReplyClassification,
  McaSubmissionStatus,
  McaSubmitMethod,
} from './constants'

@Entity({ tableName: 'mca_lead_sources' })
@Index({ name: 'mca_lead_sources_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class McaLeadSource {
  [OptionalProps]?: 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  code?: string | null

  @Property({ name: 'cost_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  costAmount?: string | null

  @Property({ name: 'cost_currency', type: 'text', nullable: true })
  costCurrency?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_lead_batches' })
@Index({ name: 'mca_lead_batches_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class McaLeadBatch {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'lead_source_id', type: 'uuid', nullable: true })
  leadSourceId?: string | null

  @Property({ type: 'text' })
  name!: string

  @Property({ name: 'purchased_at', type: Date, nullable: true })
  purchasedAt?: Date | null

  @Property({ name: 'lead_count', type: 'int', nullable: true })
  leadCount?: number | null

  @Property({ name: 'cost_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  costAmount?: string | null

  @Property({ name: 'cost_currency', type: 'text', nullable: true })
  costCurrency?: string | null

  @Property({ name: 'import_job_id', type: 'uuid', nullable: true })
  importJobId?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_intake_addresses' })
@Index({ name: 'mca_intake_addresses_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class McaIntakeAddress {
  [OptionalProps]?: 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'email_address', type: 'text' })
  emailAddress!: string

  @Property({ name: 'default_owner_user_id', type: 'uuid', nullable: true })
  defaultOwnerUserId?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_deals' })
@Index({ name: 'mca_deals_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'mca_deals_status_idx', properties: ['organizationId', 'tenantId', 'pipelineStatus'] })
@Index({ name: 'mca_deals_owner_idx', properties: ['organizationId', 'tenantId', 'ownerUserId'] })
export class McaDeal {
  [OptionalProps]?: 'pipelineStatus' | 'assignmentMethod' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'business_name', type: 'text' })
  businessName!: string

  @Property({ name: 'merchant_company_id', type: 'uuid', nullable: true })
  merchantCompanyId?: string | null

  @Property({ name: 'merchant_name_snapshot', type: 'text', nullable: true })
  merchantNameSnapshot?: string | null

  @Property({ name: 'merchant_state_snapshot', type: 'text', nullable: true })
  merchantStateSnapshot?: string | null

  @Property({ name: 'primary_person_id', type: 'uuid', nullable: true })
  primaryPersonId?: string | null

  @Property({ name: 'customer_deal_id', type: 'uuid', nullable: true })
  customerDealId?: string | null

  @Property({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId?: string | null

  @Property({ name: 'pipeline_status', type: 'text', default: 'new_app' })
  pipelineStatus: McaPipelineStatus = 'new_app'

  @Property({ name: 'requested_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  requestedAmount?: string | null

  @Property({ name: 'avg_monthly_revenue', type: 'numeric', precision: 14, scale: 2, nullable: true })
  avgMonthlyRevenue?: string | null

  @Property({ name: 'time_in_business_months', type: 'int', nullable: true })
  timeInBusinessMonths?: number | null

  @Property({ name: 'position', type: 'int', nullable: true })
  position?: number | null

  @Property({ type: 'text', nullable: true })
  industry?: string | null

  @Property({ type: 'text', nullable: true })
  state?: string | null

  @Property({ type: 'text', nullable: true })
  ein?: string | null

  @Property({ name: 'legal_address', type: 'text', nullable: true })
  legalAddress?: string | null

  @Property({ name: 'start_date', type: Date, nullable: true })
  startDate?: Date | null

  @Property({ name: 'lead_source_id', type: 'uuid', nullable: true })
  leadSourceId?: string | null

  @Property({ name: 'lead_batch_id', type: 'uuid', nullable: true })
  leadBatchId?: string | null

  @Property({ name: 'assignment_method', type: 'text', default: 'manual' })
  assignmentMethod: McaAssignmentMethod = 'manual'

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_documents' })
@Index({ name: 'mca_documents_deal_idx', properties: ['dealId', 'organizationId', 'tenantId'] })
export class McaDocument {
  [OptionalProps]?: 'isOriginal' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'deal_id', type: 'uuid' })
  dealId!: string

  @Property({ type: 'text' })
  classification!: McaDocumentClassification

  @Property({ name: 'attachment_id', type: 'uuid' })
  attachmentId!: string

  @Property({ name: 'stamped_attachment_id', type: 'uuid', nullable: true })
  stampedAttachmentId?: string | null

  @Property({ name: 'destination_funder_id', type: 'uuid', nullable: true })
  destinationFunderId?: string | null

  @Property({ name: 'is_original', type: 'boolean', default: true })
  isOriginal: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_statement_analyses' })
@Index({ name: 'mca_statement_analyses_deal_idx', properties: ['dealId', 'organizationId', 'tenantId'] })
export class McaStatementAnalysis {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'deal_id', type: 'uuid' })
  dealId!: string

  @Property({ name: 'attachment_id', type: 'uuid', nullable: true })
  attachmentId?: string | null

  @Property({ name: 'avg_monthly_revenue', type: 'numeric', precision: 14, scale: 2, nullable: true })
  avgMonthlyRevenue?: string | null

  @Property({ name: 'avg_daily_balance', type: 'numeric', precision: 14, scale: 2, nullable: true })
  avgDailyBalance?: string | null

  @Property({ name: 'deposit_count', type: 'int', nullable: true })
  depositCount?: number | null

  @Property({ name: 'nsf_count', type: 'int', nullable: true })
  nsfCount?: number | null

  @Property({ name: 'negative_days', type: 'int', nullable: true })
  negativeDays?: number | null

  @Property({ name: 'existing_positions', type: 'int', nullable: true })
  existingPositions?: number | null

  @Property({ type: 'text', nullable: true })
  model?: string | null

  @Property({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidence?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId?: string | null

  @Property({ name: 'reviewed_at', type: Date, nullable: true })
  reviewedAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_funders' })
@Index({ name: 'mca_funders_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class McaFunder {
  [OptionalProps]?: 'submitMethod' | 'requiresUnstampedStatements' | 'supportsStatusPoll' | 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  code?: string | null

  @Property({ name: 'submit_method', type: 'text', default: 'email' })
  submitMethod: McaSubmitMethod = 'email'

  @Property({ name: 'submit_email', type: 'text', nullable: true })
  submitEmail?: string | null

  @Property({ name: 'portal_url', type: 'text', nullable: true })
  portalUrl?: string | null

  @Property({ name: 'webhook_url', type: 'text', nullable: true })
  webhookUrl?: string | null

  @Property({ name: 'api_provider_key', type: 'text', nullable: true })
  apiProviderKey?: string | null

  @Property({ name: 'requires_unstamped_statements', type: 'boolean', default: false })
  requiresUnstampedStatements: boolean = false

  @Property({ name: 'supports_status_poll', type: 'boolean', default: false })
  supportsStatusPoll: boolean = false

  @Property({ type: 'json', nullable: true })
  criteria?: Record<string, unknown> | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_funder_matches' })
@Index({ name: 'mca_funder_matches_deal_idx', properties: ['dealId', 'organizationId', 'tenantId'] })
export class McaFunderMatch {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'deal_id', type: 'uuid' })
  dealId!: string

  @Property({ name: 'funder_id', type: 'uuid' })
  funderId!: string

  @Property({ type: 'numeric', precision: 5, scale: 2 })
  score!: string

  @Property({ type: 'json', nullable: true })
  reasons?: Record<string, unknown>[] | null

  @Property({ type: 'int', nullable: true })
  rank?: number | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_submissions' })
@Index({ name: 'mca_submissions_deal_idx', properties: ['dealId', 'organizationId', 'tenantId'] })
@Index({
  name: 'mca_submissions_deal_funder_unique',
  expression:
    'create unique index "mca_submissions_deal_funder_unique" on "mca_submissions" ("tenant_id", "organization_id", "deal_id", "funder_id") where "deleted_at" is null',
})
export class McaSubmission {
  [OptionalProps]?: 'status' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'deal_id', type: 'uuid' })
  dealId!: string

  @Property({ name: 'funder_id', type: 'uuid' })
  funderId!: string

  @Property({ type: 'text' })
  method!: McaSubmitMethod

  @Property({ name: 'status', type: 'text', default: 'draft' })
  status: McaSubmissionStatus = 'draft'

  @Property({ name: 'funder_reference', type: 'text', nullable: true })
  funderReference?: string | null

  @Property({ name: 'decline_reason', type: 'text', nullable: true })
  declineReason?: string | null

  @Property({ name: 'validation_errors', type: 'json', nullable: true })
  validationErrors?: Record<string, unknown> | null

  @Property({ name: 'payload_snapshot', type: 'json', nullable: true })
  payloadSnapshot?: Record<string, unknown> | null

  @Property({ name: 'sent_from_address', type: 'text', nullable: true })
  sentFromAddress?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_funder_replies' })
@Index({ name: 'mca_funder_replies_deal_idx', properties: ['dealId', 'organizationId', 'tenantId'] })
export class McaFunderReply {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'submission_id', type: 'uuid', nullable: true })
  submissionId?: string | null

  @Property({ name: 'deal_id', type: 'uuid' })
  dealId!: string

  @Property({ name: 'raw_source', type: 'text' })
  rawSource!: 'email' | 'api' | 'manual'

  @Property({ type: 'text' })
  classification!: McaReplyClassification

  @Property({ name: 'raw_body', type: 'text', nullable: true })
  rawBody?: string | null

  @Property({ name: 'parsed_payload', type: 'json', nullable: true })
  parsedPayload?: Record<string, unknown> | null

  @Property({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidence?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_offers' })
@Index({ name: 'mca_offers_deal_idx', properties: ['dealId', 'organizationId', 'tenantId'] })
export class McaOffer {
  [OptionalProps]?: 'status' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'deal_id', type: 'uuid' })
  dealId!: string

  @Property({ name: 'submission_id', type: 'uuid', nullable: true })
  submissionId?: string | null

  @Property({ name: 'funder_id', type: 'uuid', nullable: true })
  funderId?: string | null

  @Property({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  amount?: string | null

  @Property({ type: 'numeric', precision: 8, scale: 4, nullable: true })
  factor?: string | null

  @Property({ name: 'term_months', type: 'int', nullable: true })
  termMonths?: number | null

  @Property({ name: 'payment_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  paymentAmount?: string | null

  @Property({ name: 'payment_frequency', type: 'text', nullable: true })
  paymentFrequency?: McaPaymentFrequency | null

  @Property({ name: 'fees_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  feesAmount?: string | null

  @Property({ name: 'commission_points', type: 'numeric', precision: 8, scale: 4, nullable: true })
  commissionPoints?: string | null

  @Property({ type: 'json', nullable: true })
  stips?: unknown[] | null

  @Property({ name: 'status', type: 'text', default: 'open' })
  status: McaOfferStatus = 'open'

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_fundings' })
@Index({ name: 'mca_fundings_deal_idx', properties: ['dealId', 'organizationId', 'tenantId'] })
export class McaFunding {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'deal_id', type: 'uuid' })
  dealId!: string

  @Property({ name: 'offer_id', type: 'uuid', nullable: true })
  offerId?: string | null

  @Property({ name: 'funded_amount', type: 'numeric', precision: 14, scale: 2 })
  fundedAmount!: string

  @Property({ name: 'funded_at', type: Date })
  fundedAt!: Date

  @Property({ name: 'term_months', type: 'int', nullable: true })
  termMonths?: number | null

  @Property({ name: 'payment_frequency', type: 'text', nullable: true })
  paymentFrequency?: McaPaymentFrequency | null

  @Property({ name: 'payment_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  paymentAmount?: string | null

  @Property({ name: 'payback_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  paybackAmount?: string | null

  @Property({ name: 'paid_in_pct', type: 'numeric', precision: 5, scale: 2, nullable: true })
  paidInPct?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_commissions' })
@Index({ name: 'mca_commissions_deal_idx', properties: ['dealId', 'organizationId', 'tenantId'] })
export class McaCommission {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'funding_id', type: 'uuid' })
  fundingId!: string

  @Property({ name: 'deal_id', type: 'uuid' })
  dealId!: string

  @Property({ type: 'numeric', precision: 8, scale: 4, nullable: true })
  points?: string | null

  @Property({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  amount?: string | null

  @Property({ type: 'text', nullable: true })
  currency?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_commission_splits' })
@Index({ name: 'mca_commission_splits_commission_idx', properties: ['commissionId', 'organizationId', 'tenantId'] })
export class McaCommissionSplit {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'commission_id', type: 'uuid' })
  commissionId!: string

  @Property({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null

  @Property({ type: 'text', nullable: true })
  role?: string | null

  @Property({ type: 'numeric', precision: 8, scale: 4, nullable: true })
  points?: string | null

  @Property({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  amount?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_renewals' })
@Index({ name: 'mca_renewals_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class McaRenewal {
  [OptionalProps]?: 'status' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'funding_id', type: 'uuid' })
  fundingId!: string

  @Property({ name: 'deal_id', type: 'uuid' })
  dealId!: string

  @Property({ name: 'merchant_company_id', type: 'uuid', nullable: true })
  merchantCompanyId?: string | null

  @Property({ name: 'paid_in_pct', type: 'numeric', precision: 5, scale: 2, nullable: true })
  paidInPct?: string | null

  @Property({ name: 'surfaced_at', type: Date, nullable: true })
  surfacedAt?: Date | null

  @Property({ name: 'status', type: 'text', default: 'watching' })
  status: McaRenewalStatus = 'watching'

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_import_jobs' })
@Index({ name: 'mca_import_jobs_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class McaImportJob {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  source!: 'csv' | 'xlsx' | 'xls' | 'tsv' | 'zip' | 'gdrive' | 'email'

  @Property({ type: 'text' })
  status!: 'preview' | 'running' | 'completed' | 'failed'

  @Property({ name: 'deal_count', type: 'int', nullable: true })
  dealCount?: number | null

  @Property({ name: 'failure_count', type: 'int', nullable: true })
  failureCount?: number | null

  @Property({ name: 'result_attachment_id', type: 'uuid', nullable: true })
  resultAttachmentId?: string | null

  @Property({ name: 'column_map', type: 'json', nullable: true })
  columnMap?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_import_mappings' })
@Index({ name: 'mca_import_mappings_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class McaImportMapping {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'provider_name', type: 'text' })
  providerName!: string

  @Property({ name: 'column_map', type: 'json' })
  columnMap!: Record<string, unknown>

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'mca_workspace_settings' })
@Unique({ name: 'mca_workspace_settings_org_tenant_unique', properties: ['organizationId', 'tenantId'] })
export class McaWorkspaceSettings {
  [OptionalProps]?: 'watermarkEnabled' | 'renewalPaidInThreshold' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'round_robin_cursor_user_id', type: 'uuid', nullable: true })
  roundRobinCursorUserId?: string | null

  @Property({ name: 'broker_logo_attachment_id', type: 'uuid', nullable: true })
  brokerLogoAttachmentId?: string | null

  @Property({ name: 'default_from_address', type: 'text', nullable: true })
  defaultFromAddress?: string | null

  @Property({ name: 'watermark_enabled', type: 'boolean', default: true })
  watermarkEnabled: boolean = true

  @Property({ name: 'renewal_paid_in_threshold', type: 'int', default: 80 })
  renewalPaidInThreshold: number = 80

  @Property({ type: 'json', nullable: true })
  onboarding?: Record<string, unknown> | null

  @Property({ type: 'text', nullable: true })
  plan?: string | null

  @Property({ name: 'trial_ends_at', type: Date, nullable: true })
  trialEndsAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
