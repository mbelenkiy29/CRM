export const features = [
  { id: 'merchant_advances.deal.view', title: 'View MCA deals', module: 'merchant_advances' },
  {
    id: 'merchant_advances.deal.manage',
    title: 'Manage MCA deals',
    module: 'merchant_advances',
    dependsOn: ['merchant_advances.deal.view'],
  },
  { id: 'merchant_advances.funder.view', title: 'View MCA funders', module: 'merchant_advances' },
  {
    id: 'merchant_advances.funder.manage',
    title: 'Manage MCA funders',
    module: 'merchant_advances',
    dependsOn: ['merchant_advances.funder.view'],
  },
  { id: 'merchant_advances.offer.view', title: 'View MCA offers', module: 'merchant_advances' },
  {
    id: 'merchant_advances.offer.manage',
    title: 'Manage MCA offers',
    module: 'merchant_advances',
    dependsOn: ['merchant_advances.offer.view'],
  },
  { id: 'merchant_advances.submission.view', title: 'View MCA submissions', module: 'merchant_advances' },
  {
    id: 'merchant_advances.submission.manage',
    title: 'Manage MCA submissions',
    module: 'merchant_advances',
    dependsOn: ['merchant_advances.submission.view'],
  },
  {
    id: 'merchant_advances.submission.send',
    title: 'Send MCA submissions',
    module: 'merchant_advances',
    dependsOn: ['merchant_advances.submission.manage'],
  },
  {
    id: 'merchant_advances.match.manage',
    title: 'Manage MCA funder matches',
    module: 'merchant_advances',
    dependsOn: ['merchant_advances.deal.view'],
  },
  {
    id: 'merchant_advances.import.manage',
    title: 'Import MCA lead packages',
    module: 'merchant_advances',
    dependsOn: ['merchant_advances.deal.manage'],
  },
  { id: 'merchant_advances.renewal.view', title: 'View MCA renewals', module: 'merchant_advances' },
  {
    id: 'merchant_advances.reports.view',
    title: 'View MCA reports',
    module: 'merchant_advances',
    dependsOn: ['merchant_advances.deal.view'],
  },
  {
    id: 'merchant_advances.settings.manage',
    title: 'Manage MCA workspace settings',
    module: 'merchant_advances',
    dependsOn: ['merchant_advances.deal.manage'],
  },
]

export default features
