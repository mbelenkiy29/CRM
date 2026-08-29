export const MCA_PIPELINE_STATUSES = [
  'new_app',
  'statements_in',
  'underwriting',
  'matched',
  'submitted',
  'offered',
  'contracted',
  'funded',
  'declined',
  'dead',
] as const

export type McaPipelineStatus = (typeof MCA_PIPELINE_STATUSES)[number]

export const MCA_DOCUMENT_CLASSIFICATIONS = [
  'statement',
  'application',
  'id',
  'voided_check',
  'tax_return',
  'other_stip',
] as const

export type McaDocumentClassification = (typeof MCA_DOCUMENT_CLASSIFICATIONS)[number]

export const MCA_SUBMIT_METHODS = ['api', 'email', 'portal', 'webhook'] as const
export type McaSubmitMethod = (typeof MCA_SUBMIT_METHODS)[number]

export const MCA_SUBMISSION_STATUSES = [
  'draft',
  'queued',
  'sent',
  'accepted',
  'offered',
  'declined',
  'stips',
  'error',
] as const

export type McaSubmissionStatus = (typeof MCA_SUBMISSION_STATUSES)[number]

export const MCA_REPLY_CLASSIFICATIONS = ['offer', 'decline', 'stip_request', 'other'] as const
export type McaReplyClassification = (typeof MCA_REPLY_CLASSIFICATIONS)[number]

export const MCA_PAYMENT_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const
export type McaPaymentFrequency = (typeof MCA_PAYMENT_FREQUENCIES)[number]

export const MCA_OFFER_STATUSES = ['open', 'accepted', 'expired', 'withdrawn'] as const
export type McaOfferStatus = (typeof MCA_OFFER_STATUSES)[number]

export const MCA_RENEWAL_STATUSES = ['watching', 'due', 'contacted', 'renewed', 'lost'] as const
export type McaRenewalStatus = (typeof MCA_RENEWAL_STATUSES)[number]

export const MCA_ASSIGNMENT_METHODS = [
  'manual',
  'round_robin',
  'originator_column',
  'form_rule',
] as const

export type McaAssignmentMethod = (typeof MCA_ASSIGNMENT_METHODS)[number]

export const MCA_WEEKDAYS_PER_MONTH = 21
export const MCA_DEFAULT_RENEWAL_PAID_IN_THRESHOLD = 80

export const MCA_LEGAL_TRANSITIONS: Record<McaPipelineStatus, readonly McaPipelineStatus[]> = {
  new_app: ['statements_in', 'underwriting', 'dead', 'declined'],
  statements_in: ['underwriting', 'dead', 'declined'],
  underwriting: ['matched', 'submitted', 'declined', 'dead'],
  matched: ['submitted', 'declined', 'dead'],
  submitted: ['offered', 'declined', 'dead', 'submitted'],
  offered: ['contracted', 'funded', 'declined', 'dead', 'submitted'],
  contracted: ['funded', 'declined', 'dead'],
  funded: ['dead'],
  declined: ['new_app', 'dead'],
  dead: ['new_app'],
}
