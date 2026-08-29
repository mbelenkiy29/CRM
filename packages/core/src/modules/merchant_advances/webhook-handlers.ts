import type { WebhookHandlerRegistryEntry } from '@open-mercato/shared/lib/webhooks'

const sources = ['mca_jotform', 'mca_gohighlevel', 'mca_zoho', 'mca_custom'] as const

export const webhookHandlers: WebhookHandlerRegistryEntry[] = sources.map((source) => ({
  meta: {
    source,
    event: '*',
    id: `merchant_advances:intake-${source}`,
    persistent: true,
  },
  handler: () => import('./lib/intake/webhookHandler'),
}))

export default webhookHandlers
