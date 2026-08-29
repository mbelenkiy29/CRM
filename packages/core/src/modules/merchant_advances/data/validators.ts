import { z } from 'zod'
import {
  MCA_ASSIGNMENT_METHODS,
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
