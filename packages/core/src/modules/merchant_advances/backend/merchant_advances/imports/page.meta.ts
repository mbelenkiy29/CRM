export const metadata = {
  requireAuth: true,
  requireFeatures: ['merchant_advances.import.manage'],
  pageTitle: 'Import deals',
  pageTitleKey: 'merchant_advances.imports.title',
  pageGroup: 'MCA',
  pageGroupKey: 'merchant_advances.nav.group',
  pagePriority: 8,
  pageOrder: 15,
  icon: 'upload',
  breadcrumb: [
    { label: 'Deals', labelKey: 'merchant_advances.nav.deals', href: '/backend/merchant_advances' },
    { label: 'Import', labelKey: 'merchant_advances.imports.title' },
  ],
}
