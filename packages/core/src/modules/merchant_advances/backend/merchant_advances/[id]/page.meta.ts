export const metadata = {
  requireAuth: true,
  requireFeatures: ['merchant_advances.deal.view'],
  pageTitle: 'Deal details',
  pageTitleKey: 'merchant_advances.detail.title',
  pageGroup: 'MCA',
  pageGroupKey: 'merchant_advances.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Deals', labelKey: 'merchant_advances.nav.deals', href: '/backend/merchant_advances' },
    { label: 'Deal details', labelKey: 'merchant_advances.detail.title' },
  ],
}
