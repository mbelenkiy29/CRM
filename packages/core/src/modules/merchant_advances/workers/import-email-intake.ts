import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { ingestForwardedLeadEmail } from '../lib/import/sources'

const logger = createLogger('merchant_advances')

export const MCA_IMPORT_EMAIL_INTAKE_QUEUE = 'merchant-advances-import-email-intake'

export const metadata: WorkerMeta = {
  queue: MCA_IMPORT_EMAIL_INTAKE_QUEUE,
  id: 'merchant_advances:import-email-intake',
  concurrency: 1,
}

type EmailIntakePayload = {
  rawMessage: string
  intakeAddress: string
}

export default async function handle(
  job: QueuedJob<EmailIntakePayload>,
  _ctx: JobContext,
): Promise<void> {
  // TODO: tryResolve channel_imap / channel_gmail, parse the forwarded lead, assign, and reply with the deal link.
  logger.warn('Private intake email worker is stubbed', { intakeAddress: job.payload.intakeAddress })
  await ingestForwardedLeadEmail(job.payload)
}
