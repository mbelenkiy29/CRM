import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'merchant_advances',
  title: 'Merchant Cash Advances',
  version: '0.1.0',
  description: 'MCA broker CRM: intake, underwriting, funder match, submissions, offers, renewals, and commissions.',
  author: 'Open Mercato',
  license: 'MIT',
  ejectable: true,
}

export { features } from './acl'
