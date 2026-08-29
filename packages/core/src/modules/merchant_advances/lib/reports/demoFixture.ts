import type { ReportSnapshot } from './aggregates'

const REP_A = '018f1a2b-3c4d-4000-8000-0000000000aa'
const REP_B = '018f1a2b-3c4d-4000-8000-0000000000bb'
const HARBOR = '018f1a2b-3c4d-4000-8000-0000000000cc'
const NORTHSTAR = '018f1a2b-3c4d-4000-8000-0000000000dd'
const SOURCE = '018f1a2b-3c4d-4000-8000-0000000000ee'

export function buildReportDemoFixture(): ReportSnapshot {
  return {
    deals: [
      {
        id: '018f1a2b-3c4d-4000-8000-000000000101',
        ownerUserId: REP_A,
        pipelineStatus: 'funded',
        requestedAmount: '75000.00',
        leadSourceId: SOURCE,
        leadBatchId: null,
      },
      {
        id: '018f1a2b-3c4d-4000-8000-000000000102',
        ownerUserId: REP_B,
        pipelineStatus: 'offered',
        requestedAmount: '50000.00',
        leadSourceId: SOURCE,
        leadBatchId: null,
      },
      {
        id: '018f1a2b-3c4d-4000-8000-000000000103',
        ownerUserId: REP_A,
        pipelineStatus: 'submitted',
        requestedAmount: '40000.00',
        leadSourceId: SOURCE,
        leadBatchId: null,
      },
    ],
    fundings: [
      { dealId: '018f1a2b-3c4d-4000-8000-000000000101', fundedAmount: '75000.00', paymentAmount: '785.71' },
    ],
    commissions: [
      { dealId: '018f1a2b-3c4d-4000-8000-000000000101', amount: '7500.00' },
    ],
    splits: [
      { userId: REP_A, amount: '7500.00' },
    ],
    submissions: [
      { dealId: '018f1a2b-3c4d-4000-8000-000000000101', funderId: HARBOR, status: 'accepted' },
      { dealId: '018f1a2b-3c4d-4000-8000-000000000102', funderId: NORTHSTAR, status: 'offered' },
      { dealId: '018f1a2b-3c4d-4000-8000-000000000103', funderId: HARBOR, status: 'sent' },
    ],
    offers: [
      { dealId: '018f1a2b-3c4d-4000-8000-000000000101', funderId: HARBOR, status: 'accepted' },
      { dealId: '018f1a2b-3c4d-4000-8000-000000000102', funderId: NORTHSTAR, status: 'open' },
    ],
    leadSources: [
      { id: SOURCE, name: 'ISO partners', costAmount: '3000.00' },
    ],
    leadBatches: [],
  }
}
