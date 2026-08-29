import { createHmac } from 'crypto'
import type { McaSubmitMethod, McaSubmissionStatus } from '../../data/constants'

export type SubmitPackage = {
  dealId: string
  funderId: string
  funderName: string
  method: McaSubmitMethod
  fromAddress: string | null
  submitEmail: string | null
  portalUrl: string | null
  webhookUrl: string | null
  application: Record<string, unknown>
  documents: Array<{ id: string; classification: string; attachmentId: string; stamped: boolean }>
}

export type SubmitRouteResult = {
  status: McaSubmissionStatus
  funderReference: string | null
  validationErrors: Record<string, unknown> | null
  payloadSnapshot: Record<string, unknown>
}

export function signWebhookPayload(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signed = `${timestamp}.${body}`
  const digest = createHmac('sha256', secret).update(signed).digest('hex')
  return `t=${timestamp},v1=${digest}`
}

export function routeSubmission(pack: SubmitPackage, options?: { mailConfigured?: boolean }): SubmitRouteResult {
  if (pack.method === 'api') {
    return {
      status: 'error',
      funderReference: null,
      validationErrors: { code: 'api_deferred', message: 'Live funder HTTP APIs are deferred.' },
      payloadSnapshot: { route: 'api_deferred', application: pack.application, documents: pack.documents },
    }
  }

  if (pack.method === 'portal') {
    return {
      status: 'draft',
      funderReference: 'portal-task',
      validationErrors: null,
      payloadSnapshot: {
        route: 'portal',
        task: 'complete funder portal',
        portalUrl: pack.portalUrl,
        application: pack.application,
        documents: pack.documents,
      },
    }
  }

  if (pack.method === 'webhook') {
    if (!pack.webhookUrl) {
      return {
        status: 'error',
        funderReference: null,
        validationErrors: { code: 'webhook_url_missing' },
        payloadSnapshot: { route: 'webhook', application: pack.application },
      }
    }
    const body = JSON.stringify({
      dealId: pack.dealId,
      funderId: pack.funderId,
      application: pack.application,
      documents: pack.documents,
    })
    return {
      status: 'sent',
      funderReference: null,
      validationErrors: null,
      payloadSnapshot: {
        route: 'webhook',
        url: pack.webhookUrl,
        body,
        signature: signWebhookPayload(body, pack.funderId),
      },
    }
  }

  const mailConfigured = options?.mailConfigured === true
  const emailPayload = {
    route: 'email',
    to: pack.submitEmail,
    from: pack.fromAddress,
    subject: `MCA application — ${pack.funderName}`,
    application: pack.application,
    documents: pack.documents,
  }
  if (!pack.submitEmail) {
    return {
      status: 'error',
      funderReference: null,
      validationErrors: { code: 'submit_email_missing' },
      payloadSnapshot: emailPayload,
    }
  }
  if (!mailConfigured) {
    return {
      status: 'queued',
      funderReference: null,
      validationErrors: null,
      payloadSnapshot: { ...emailPayload, queuedEmail: true },
    }
  }
  return {
    status: 'sent',
    funderReference: null,
    validationErrors: null,
    payloadSnapshot: emailPayload,
  }
}
