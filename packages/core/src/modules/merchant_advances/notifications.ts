import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'merchant_advances.deal.created',
    channels: ['in_app'],
    module: 'merchant_advances',
    titleKey: 'merchant_advances.notifications.dealCreated.title',
    bodyKey: 'merchant_advances.notifications.dealCreated.body',
    icon: 'briefcase',
    severity: 'info',
    linkHref: '/backend/merchant_advances?id={sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'merchant_advances.submission.failed',
    channels: ['in_app', 'email'],
    module: 'merchant_advances',
    titleKey: 'merchant_advances.notifications.submissionFailed.title',
    bodyKey: 'merchant_advances.notifications.submissionFailed.body',
    icon: 'triangle-alert',
    severity: 'warning',
    linkHref: '/backend/merchant_advances?id={sourceEntityId}',
    expiresAfterHours: 168,
  },
]
