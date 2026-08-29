import { asValue } from 'awilix'
import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import {
  McaDeal,
  McaDocument,
  McaFunder,
  McaImportJob,
  McaImportMapping,
  McaIntakeAddress,
  McaLeadBatch,
  McaLeadSource,
  McaOffer,
  McaStatementAnalysis,
  McaSubmission,
  McaWorkspaceSettings,
} from './data/entities'

export function register(container: AppContainer) {
  container.register({
    McaDeal: asValue(McaDeal),
    McaDocument: asValue(McaDocument),
    McaFunder: asValue(McaFunder),
    McaImportJob: asValue(McaImportJob),
    McaImportMapping: asValue(McaImportMapping),
    McaIntakeAddress: asValue(McaIntakeAddress),
    McaLeadBatch: asValue(McaLeadBatch),
    McaLeadSource: asValue(McaLeadSource),
    McaOffer: asValue(McaOffer),
    McaStatementAnalysis: asValue(McaStatementAnalysis),
    McaSubmission: asValue(McaSubmission),
    McaWorkspaceSettings: asValue(McaWorkspaceSettings),
  })
}
