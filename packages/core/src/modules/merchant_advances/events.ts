import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'merchant_advances.deal.created', label: 'MCA Deal Created', entity: 'deal', category: 'crud', clientBroadcast: true },
  { id: 'merchant_advances.deal.updated', label: 'MCA Deal Updated', entity: 'deal', category: 'crud', clientBroadcast: true },
  { id: 'merchant_advances.deal.deleted', label: 'MCA Deal Deleted', entity: 'deal', category: 'crud' },
  { id: 'merchant_advances.deal.stage_changed', label: 'MCA Deal Stage Changed', entity: 'deal', category: 'lifecycle', clientBroadcast: true },
  { id: 'merchant_advances.deal.funded', label: 'MCA Deal Funded', entity: 'deal', category: 'lifecycle', clientBroadcast: true },
  { id: 'merchant_advances.statement.analyzed', label: 'MCA Statement Analyzed', entity: 'statement', category: 'lifecycle', clientBroadcast: true },
  { id: 'merchant_advances.funder.matched', label: 'MCA Funder Matched', entity: 'funder', category: 'lifecycle' },
  { id: 'merchant_advances.submission.created', label: 'MCA Submission Created', entity: 'submission', category: 'crud', clientBroadcast: true },
  { id: 'merchant_advances.submission.sent', label: 'MCA Submission Sent', entity: 'submission', category: 'lifecycle', clientBroadcast: true },
  { id: 'merchant_advances.submission.failed', label: 'MCA Submission Failed', entity: 'submission', category: 'lifecycle', clientBroadcast: true },
  { id: 'merchant_advances.reply.inbound_received', label: 'MCA Funder Reply Inbound', entity: 'reply', category: 'lifecycle' },
  { id: 'merchant_advances.reply.parsed', label: 'MCA Funder Reply Parsed', entity: 'reply', category: 'lifecycle', clientBroadcast: true },
  { id: 'merchant_advances.offer.created', label: 'MCA Offer Created', entity: 'offer', category: 'crud', clientBroadcast: true },
  { id: 'merchant_advances.funding.created', label: 'MCA Funding Created', entity: 'funding', category: 'crud', clientBroadcast: true },
  { id: 'merchant_advances.renewal.surfaced', label: 'MCA Renewal Surfaced', entity: 'renewal', category: 'lifecycle', clientBroadcast: true },
  { id: 'merchant_advances.import.completed', label: 'MCA Import Completed', entity: 'import', category: 'lifecycle', clientBroadcast: true },
  { id: 'merchant_advances.onboarding.step_completed', label: 'MCA Onboarding Step Completed', entity: 'onboarding', category: 'lifecycle' },
  { id: 'merchant_advances.onboarding.completed', label: 'MCA Onboarding Completed', entity: 'onboarding', category: 'lifecycle', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'merchant_advances', events })
export const emitMerchantAdvancesEvent = eventsConfig.emit
export type MerchantAdvancesEventId = typeof events[number]['id']
export default eventsConfig
