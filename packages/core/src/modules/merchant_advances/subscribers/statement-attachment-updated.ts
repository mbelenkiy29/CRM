import { createLogger } from '@open-mercato/shared/lib/logger'
import { enqueueAnalysisFromAttachment, type ResolverContext } from '../lib/underwriting/enqueueFromEvent'

const logger = createLogger('merchant_advances').child({ component: 'statement-attachment-updated' })

export const metadata = {
  event: 'attachments.attachment.updated',
  persistent: true,
  id: 'merchant_advances:statement-attachment-updated',
}

export default async function handleAttachmentUpdated(
  payload: Record<string, unknown>,
  ctx: ResolverContext,
): Promise<void> {
  try {
    await enqueueAnalysisFromAttachment(payload, ctx)
  } catch (error) {
    logger.warn('failed to queue statement analysis after attachment update', {
      attachmentId: payload.id,
      err: error instanceof Error ? error.message : error,
    })
  }
}
