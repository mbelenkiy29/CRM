import type { WebhookSourceConfig } from '@open-mercato/shared/lib/webhooks'
import {
  extractIntakeEventType,
  extractIntakeMessageId,
  verifySharedIntakeSecret,
} from './lib/intake/sourceVerifier'

const credentialFields = [
  { key: 'secret', label: 'Webhook secret', secret: true, required: true },
]

function source(key: string, label: string): WebhookSourceConfig {
  return {
    key,
    label,
    verifier: verifySharedIntakeSecret,
    eventTypeExtractor: extractIntakeEventType,
    messageIdExtractor: extractIntakeMessageId,
    credentialFields,
  }
}

export const webhookSources: WebhookSourceConfig[] = [
  source('mca_jotform', 'MCA JotForm'),
  source('mca_gohighlevel', 'MCA GoHighLevel'),
  source('mca_zoho', 'MCA Zoho'),
  source('mca_custom', 'MCA custom form'),
]

export default webhookSources
