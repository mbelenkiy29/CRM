import { z } from 'zod'
import {
  MCA_ASSIGNMENT_METHODS,
  MCA_IMPORT_FIELD_KEYS,
  MCA_IMPORT_SOURCES,
  MCA_OFFER_STATUSES,
  MCA_PAYMENT_FREQUENCIES,
  MCA_PIPELINE_STATUSES,
  MCA_RENEWAL_STATUSES,
  MCA_REPLY_CLASSIFICATIONS,
  MCA_SUBMISSION_STATUSES,
  MCA_SUBMIT_METHODS,
} from './constants'

const uuid = z.string().uuid()
const money = z.union([z.string(), z.number()]).optional().nullable()

export const dealCreateSchema = z.object({
  businessName: z.string().trim().min(1).max(300),
  merchantCompanyId: uuid.optional().nullable(),
  merchantNameSnapshot: z.string().trim().max(300).optional().nullable(),
  merchantStateSnapshot: z.string().trim().max(8).optional().nullable(),
  primaryPersonId: uuid.optional().nullable(),
  customerDealId: uuid.optional().nullable(),
  ownerUserId: uuid.optional().nullable(),
  pipelineStatus: z.enum(MCA_PIPELINE_STATUSES).optional(),
  requestedAmount: money,
  avgMonthlyRevenue: money,
  timeInBusinessMonths: z.number().int().min(0).max(1200).optional().nullable(),
  position: z.number().int().min(1).max(20).optional().nullable(),
  industry: z.string().trim().max(200).optional().nullable(),
  state: z.string().trim().max(8).optional().nullable(),
  ein: z.string().trim().max(32).optional().nullable(),
  legalAddress: z.string().trim().max(500).optional().nullable(),
  startDate: z.string().optional().nullable(),
  leadSourceId: uuid.optional().nullable(),
  leadBatchId: uuid.optional().nullable(),
  assignmentMethod: z.enum(MCA_ASSIGNMENT_METHODS).optional(),
})

export const dealUpdateSchema = dealCreateSchema.partial().extend({
  id: uuid,
})

export const dealDeleteSchema = z.object({ id: uuid })

export const funderCreateSchema = z.object({
  name: z.string().trim().min(1).max(300),
  code: z.string().trim().max(80).optional().nullable(),
  submitMethod: z.enum(MCA_SUBMIT_METHODS).optional(),
  submitEmail: z.string().email().optional().nullable(),
  portalUrl: z.string().url().optional().nullable(),
  webhookUrl: z.string().url().optional().nullable(),
  apiProviderKey: z.string().trim().max(120).optional().nullable(),
  requiresUnstampedStatements: z.boolean().optional(),
  supportsStatusPoll: z.boolean().optional(),
  criteria: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().optional(),
})

export const funderUpdateSchema = funderCreateSchema.partial().extend({ id: uuid })
export const funderDeleteSchema = z.object({ id: uuid })

export const offerCreateSchema = z.object({
  dealId: uuid,
  submissionId: uuid.optional().nullable(),
  funderId: uuid.optional().nullable(),
  amount: money,
  factor: money,
  termMonths: z.number().int().min(1).max(120).optional().nullable(),
  paymentAmount: money,
  paymentFrequency: z.enum(MCA_PAYMENT_FREQUENCIES).optional().nullable(),
  feesAmount: money,
  commissionPoints: money,
  stips: z.array(z.unknown()).optional().nullable(),
  status: z.enum(MCA_OFFER_STATUSES).optional(),
})

export const offerUpdateSchema = offerCreateSchema.partial().extend({ id: uuid })
export const offerDeleteSchema = z.object({ id: uuid })

export const submissionCreateSchema = z.object({
  dealId: uuid,
  funderId: uuid,
  method: z.enum(MCA_SUBMIT_METHODS).optional(),
  status: z.enum(MCA_SUBMISSION_STATUSES).optional(),
  funderReference: z.string().trim().max(200).optional().nullable(),
  declineReason: z.string().trim().max(2000).optional().nullable(),
  sentFromAddress: z.string().email().optional().nullable(),
})

export const submissionUpdateSchema = submissionCreateSchema.partial().extend({ id: uuid })
export const submissionDeleteSchema = z.object({ id: uuid })

export const fundingSplitSchema = z.object({
  userId: uuid.optional().nullable(),
  role: z.string().trim().max(80).optional().nullable(),
  points: z.union([z.string(), z.number()]),
})

export const fundingCreateSchema = z.object({
  offerId: uuid,
  fundedAmount: money,
  fundedAt: z.string().optional().nullable(),
  currency: z.string().trim().max(8).optional().nullable(),
  splits: z.array(fundingSplitSchema).optional(),
  dealUpdatedAt: z.string().optional().nullable(),
  offerUpdatedAt: z.string().optional().nullable(),
  organizationId: uuid.optional(),
  tenantId: uuid.optional(),
})

export const fundingDeleteSchema = z.object({ id: uuid })

export const replyCreateSchema = z.object({
  dealId: uuid,
  submissionId: uuid.optional().nullable(),
  rawSource: z.enum(['email', 'api', 'manual']).optional(),
  classification: z.enum(MCA_REPLY_CLASSIFICATIONS).optional(),
  rawBody: z.string().trim().max(20000).optional().nullable(),
  parsedPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  organizationId: uuid.optional(),
  tenantId: uuid.optional(),
})

export const replyUpdateSchema = replyCreateSchema.partial().extend({ id: uuid })
export const replyDeleteSchema = z.object({ id: uuid })

export const renewalCreateSchema = z.object({
  dealId: uuid,
  fundingId: uuid,
  merchantCompanyId: uuid.optional().nullable(),
  paidInPct: money,
  status: z.enum(MCA_RENEWAL_STATUSES).optional(),
  organizationId: uuid.optional(),
  tenantId: uuid.optional(),
})

export const renewalUpdateSchema = z.object({
  id: uuid,
  status: z.enum(MCA_RENEWAL_STATUSES),
  dealUpdatedAt: z.string().optional().nullable(),
})

export const renewalDeleteSchema = z.object({ id: uuid })

export const submitSendSchema = z.object({
  dealId: uuid,
  funderIds: z.array(uuid).min(1).max(20),
  organizationId: uuid.optional(),
  tenantId: uuid.optional(),
})

export const replyInboundSchema = z.object({
  subject: z.string().trim().max(500).optional().nullable(),
  body: z.string().trim().max(20000).optional().nullable(),
  from: z.string().trim().max(320).optional().nullable(),
  to: z.string().trim().max(320).optional().nullable(),
  attachments: z.array(z.object({
    filename: z.string().trim().max(300).optional(),
    contentType: z.string().trim().max(200).optional(),
  })).max(20).optional(),
  dealId: uuid.optional().nullable(),
  funderId: uuid.optional().nullable(),
  funderReference: z.string().trim().max(200).optional().nullable(),
  source: z.enum(['email', 'api', 'manual']).optional(),
  status: z.enum(['offered', 'declined', 'stips', 'accepted', 'sent']).optional().nullable(),
  amount: money,
  factor: money,
  termMonths: z.number().int().min(1).max(120).optional().nullable(),
  paymentAmount: money,
  paymentFrequency: z.enum(MCA_PAYMENT_FREQUENCIES).optional().nullable(),
  feesAmount: money,
  commissionPoints: money,
  stips: z.array(z.string().trim().max(300)).max(30).optional().nullable(),
  declineReason: z.string().trim().max(2000).optional().nullable(),
  organizationId: uuid.optional(),
  tenantId: uuid.optional(),
})

export const matchRefreshSchema = z.object({
  dealId: uuid,
  organizationId: uuid.optional(),
  tenantId: uuid.optional(),
})

export type DealCreateInput = z.infer<typeof dealCreateSchema>
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>
export type FunderCreateInput = z.infer<typeof funderCreateSchema>
export type FunderUpdateInput = z.infer<typeof funderUpdateSchema>
export type OfferCreateInput = z.infer<typeof offerCreateSchema>
export type OfferUpdateInput = z.infer<typeof offerUpdateSchema>
export type SubmissionCreateInput = z.infer<typeof submissionCreateSchema>
export type SubmissionUpdateInput = z.infer<typeof submissionUpdateSchema>
export type FundingSplitInput = z.infer<typeof fundingSplitSchema>
export type FundingCreateInput = z.infer<typeof fundingCreateSchema>
export type ReplyCreateInput = z.infer<typeof replyCreateSchema>
export type RenewalCreateInput = z.infer<typeof renewalCreateSchema>
export type RenewalUpdateInput = z.infer<typeof renewalUpdateSchema>
export type MatchRefreshInput = z.infer<typeof matchRefreshSchema>
export type SubmitSendInput = z.infer<typeof submitSendSchema>
export type ReplyInboundInput = z.infer<typeof replyInboundSchema>

export const intakeFormProviders = ['jotform', 'gohighlevel', 'zoho', 'custom'] as const

export const intakeFormSchema = z.object({
  provider: z.enum(intakeFormProviders).optional(),
  organizationId: uuid.optional(),
  tenantId: uuid.optional(),
}).passthrough()

export const intakeCommandSchema = dealCreateSchema.extend({
  organizationId: uuid,
  tenantId: uuid,
  ownerEmail: z.string().email().optional().nullable(),
  ownerFirstName: z.string().trim().max(120).optional().nullable(),
  ownerLastName: z.string().trim().max(120).optional().nullable(),
  ownerPhone: z.string().trim().max(50).optional().nullable(),
  leadSourceCode: z.string().trim().max(80).optional().nullable(),
  statementUrls: z.array(z.string().url()).optional(),
  statementAttachmentIds: z.array(uuid).optional(),
  applicationAttachmentIds: z.array(uuid).optional(),
  provider: z.enum(intakeFormProviders).optional(),
})

export const issueUploadTokenSchema = z.object({
  dealId: uuid,
  classification: z.enum(['statement', 'application', 'id', 'voided_check', 'tax_return', 'other_stip']).optional(),
})

export const workspaceSettingsUpdateSchema = z.object({
  defaultFromAddress: z.string().email().optional().nullable(),
  watermarkEnabled: z.boolean().optional(),
  uploadLinksEnabled: z.boolean().optional(),
  uploadLinkTtlHours: z.number().int().min(1).max(720).optional(),
  intakeWebhookSecret: z.string().trim().min(8).max(200).optional().nullable(),
})

export const workspaceSettingsSaveSchema = workspaceSettingsUpdateSchema.extend({
  organizationId: uuid,
  tenantId: uuid,
})

export const statementAnalyzeSchema = z.object({
  dealId: uuid,
  attachmentId: uuid.optional().nullable(),
  documentId: uuid.optional().nullable(),
  markdown: z.string().max(200_000).optional().nullable(),
  force: z.boolean().optional(),
  organizationId: uuid.optional(),
  tenantId: uuid.optional(),
})

export const statementReviewSchema = z.object({
  id: uuid,
  updatedAt: z.string().optional().nullable(),
  organizationId: uuid.optional(),
  tenantId: uuid.optional(),
})

export const renewalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(MCA_RENEWAL_STATUSES).optional(),
})

const importFieldKey = z.enum(MCA_IMPORT_FIELD_KEYS)
const columnMapSchema = z.record(z.string(), importFieldKey.nullable())

const importFileRefSchema = z.object({
  path: z.string().trim().min(1).max(500),
  name: z.string().trim().min(1).max(300),
  attachmentId: uuid.optional().nullable(),
})

const originatorDirectoryEntrySchema = z.object({
  name: z.string().trim().min(1).max(200),
  userId: uuid,
})

const mappedDealFieldsSchema = z.object({
  businessName: z.string().trim().max(300).nullable(),
  requestedAmount: z.string().trim().max(40).nullable(),
  avgMonthlyRevenue: z.string().trim().max(40).nullable(),
  timeInBusinessMonths: z.number().int().min(0).max(1200).nullable(),
  position: z.number().int().min(1).max(20).nullable(),
  industry: z.string().trim().max(200).nullable(),
  state: z.string().trim().max(8).nullable(),
  ein: z.string().trim().max(32).nullable(),
  legalAddress: z.string().trim().max(500).nullable(),
  originator: z.string().trim().max(200).nullable(),
  folderName: z.string().trim().max(300).nullable(),
  startDate: z.string().trim().max(40).nullable(),
})

const importPreviewRowSchema = z.object({
  rowIndex: z.number().int().min(0),
  businessName: z.string().trim().max(300).nullable(),
  fields: mappedDealFieldsSchema,
  pdfFilledFields: z.array(z.string()),
  files: z.array(importFileRefSchema.extend({
    classification: z.enum(['statement', 'application', 'id', 'voided_check', 'tax_return', 'other_stip']),
  })),
  ownerUserId: uuid.nullable(),
  originatorValue: z.string().trim().max(200).nullable(),
  assignmentMethod: z.enum(MCA_ASSIGNMENT_METHODS),
  status: z.enum(['ready', 'failed']),
  failureReason: z.string().trim().max(200).nullable(),
})

export const importPreviewRequestSchema = z.object({
  source: z.enum(MCA_IMPORT_SOURCES).default('csv'),
  spreadsheetText: z.string().min(1).max(2_000_000),
  filename: z.string().trim().max(300).optional().nullable(),
  columnMap: columnMapSchema.optional().nullable(),
  files: z.array(importFileRefSchema).max(5000).optional(),
  assignmentMethod: z.enum(MCA_ASSIGNMENT_METHODS).optional(),
  assigneeUserIds: z.array(uuid).max(200).optional(),
  originatorDirectory: z.array(originatorDirectoryEntrySchema).max(200).optional(),
  roundRobinCursorUserId: uuid.optional().nullable(),
  applicationTexts: z.record(z.string(), z.string().max(200_000)).optional(),
})

export const importCommitRequestSchema = z.object({
  source: z.enum(MCA_IMPORT_SOURCES).default('csv'),
  rows: z.array(importPreviewRowSchema).min(1).max(1000),
  columnMap: columnMapSchema,
  assignmentMethod: z.enum(MCA_ASSIGNMENT_METHODS),
  leadSourceId: uuid.optional().nullable(),
  leadSourceName: z.string().trim().max(200).optional().nullable(),
  leadBatchName: z.string().trim().max(200).optional().nullable(),
  saveMappingAs: z.string().trim().max(120).optional().nullable(),
  roundRobinCursorUserId: uuid.optional().nullable(),
})

export const leadSourceCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(80).optional().nullable(),
  costAmount: money,
  costCurrency: z.string().trim().max(8).optional().nullable(),
  isActive: z.boolean().optional(),
})

export const leadBatchCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  leadSourceId: uuid.optional().nullable(),
  purchasedAt: z.string().optional().nullable(),
  leadCount: z.number().int().min(0).optional().nullable(),
  costAmount: money,
  costCurrency: z.string().trim().max(8).optional().nullable(),
})

export const intakeAddressCreateSchema = z.object({
  emailAddress: z.string().email().max(300),
  defaultOwnerUserId: uuid.optional().nullable(),
  isActive: z.boolean().optional(),
})

export const importMappingCreateSchema = z.object({
  providerName: z.string().trim().min(1).max(120),
  columnMap: columnMapSchema,
})

export type IntakeCommandInput = z.infer<typeof intakeCommandSchema>
export type WorkspaceSettingsSaveInput = z.infer<typeof workspaceSettingsSaveSchema>
export type WorkspaceSettingsUpdateInput = z.infer<typeof workspaceSettingsUpdateSchema>
export type StatementAnalyzeInput = z.infer<typeof statementAnalyzeSchema>
export type StatementReviewInput = z.infer<typeof statementReviewSchema>
export type RenewalListQuery = z.infer<typeof renewalListQuerySchema>
export type ImportPreviewRequest = z.infer<typeof importPreviewRequestSchema>
export type ImportCommitRequest = z.infer<typeof importCommitRequestSchema>
