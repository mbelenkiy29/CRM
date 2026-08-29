import { z } from 'zod'
import {
  MCA_ASSIGNMENT_METHODS,
  MCA_OFFER_STATUSES,
  MCA_PAYMENT_FREQUENCIES,
  MCA_PIPELINE_STATUSES,
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

export type DealCreateInput = z.infer<typeof dealCreateSchema>
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>
export type FunderCreateInput = z.infer<typeof funderCreateSchema>
export type FunderUpdateInput = z.infer<typeof funderUpdateSchema>
export type OfferCreateInput = z.infer<typeof offerCreateSchema>
export type OfferUpdateInput = z.infer<typeof offerUpdateSchema>
export type SubmissionCreateInput = z.infer<typeof submissionCreateSchema>
export type SubmissionUpdateInput = z.infer<typeof submissionUpdateSchema>
export type IntakeCommandInput = z.infer<typeof intakeCommandSchema>
export type WorkspaceSettingsSaveInput = z.infer<typeof workspaceSettingsSaveSchema>
export type WorkspaceSettingsUpdateInput = z.infer<typeof workspaceSettingsUpdateSchema>
