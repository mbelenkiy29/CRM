export const metadata = {
  requireAuth: true,
  requireFeatures: ['merchant_advances.renewal.view'],
  pageTitle: 'Renewal queue',
  pageTitleKey: 'merchant_advances.nav.renewalQueue',
  pageGroup: 'MCA',
  pageGroupKey: 'merchant_advances.nav.group',
  pagePriority: 8,
  pageOrder: 41,
  icon: 'list',
  breadcrumb: [
    { label: 'Renewals', labelKey: 'merchant_advances.nav.renewals', href: '/backend/merchant_advances/renewals' },
    { label: 'Queue', labelKey: 'merchant_advances.nav.renewalQueue' },
  ],
}
