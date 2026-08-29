export const metadata = {
  requireAuth: true,
  requireFeatures: ['merchant_advances.deal.manage'],
  pageTitle: 'New MCA deal',
  pageTitleKey: 'merchant_advances.create.title',
  pageGroup: 'MCA',
  pageGroupKey: 'merchant_advances.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Deals', labelKey: 'merchant_advances.nav.deals', href: '/backend/merchant_advances' },
    { label: 'New deal', labelKey: 'merchant_advances.create.title' },
  ],
}
