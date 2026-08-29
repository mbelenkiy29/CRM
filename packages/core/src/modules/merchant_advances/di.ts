import { asValue } from 'awilix'
import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { McaDeal, McaDocument, McaFunder, McaOffer, McaStatementAnalysis, McaSubmission } from './data/entities'

export function register(container: AppContainer) {
  container.register({
    McaDeal: asValue(McaDeal),
    McaDocument: asValue(McaDocument),
    McaFunder: asValue(McaFunder),
    McaOffer: asValue(McaOffer),
    McaStatementAnalysis: asValue(McaStatementAnalysis),
    McaSubmission: asValue(McaSubmission),
  })
}
