import { createLogger } from '@open-mercato/shared/lib/logger'
import { enqueueAnalysisFromAttachment, type ResolverContext } from '../lib/underwriting/enqueueFromEvent'

const logger = createLogger('merchant_advances').child({ component: 'statement-attachment-created' })

export const metadata = {
  event: 'attachments.attachment.created',
  persistent: true,
  id: 'merchant_advances:statement-attachment-created',
}

export default async function handleAttachmentCreated(
  payload: Record<string, unknown>,
  ctx: ResolverContext,
): Promise<void> {
  try {
    await enqueueAnalysisFromAttachment(payload, ctx)
  } catch (error) {
    logger.warn('failed to queue statement analysis after attachment create', {
      attachmentId: payload.id,
      err: error instanceof Error ? error.message : error,
    })
  }
}
