import { asValue } from 'awilix'
import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { McaDeal, McaFunder, McaOffer, McaSubmission } from './data/entities'

export function register(container: AppContainer) {
  container.register({
    McaDeal: asValue(McaDeal),
    McaFunder: asValue(McaFunder),
    McaOffer: asValue(McaOffer),
    McaSubmission: asValue(McaSubmission),
  })
}
