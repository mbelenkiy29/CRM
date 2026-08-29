export const entities = [
  {
    id: 'merchant_advances:mca_deal',
    label: 'MCA Deal',
    description: 'Merchant cash advance application and pipeline record.',
    labelField: 'businessName',
    showInSidebar: false,
    fields: [],
  },
  {
    id: 'merchant_advances:mca_funder',
    label: 'MCA Funder',
    description: 'Funder catalog entry with appetite criteria and submit method.',
    labelField: 'name',
    showInSidebar: false,
    fields: [],
  },
  {
    id: 'merchant_advances:mca_offer',
    label: 'MCA Offer',
    description: 'Structured funder offer on an MCA deal.',
    labelField: 'amount',
    showInSidebar: false,
    fields: [],
  },
  {
    id: 'merchant_advances:mca_submission',
    label: 'MCA Submission',
    description: 'Per-funder submission record.',
    labelField: 'status',
    showInSidebar: false,
    fields: [],
  },
  {
    id: 'merchant_advances:mca_funding',
    label: 'MCA Funding',
    description: 'Funded offer record with payback, payment, and commission distribution.',
    labelField: 'fundedAmount',
    showInSidebar: false,
    fields: [],
  },
]

export default entities
