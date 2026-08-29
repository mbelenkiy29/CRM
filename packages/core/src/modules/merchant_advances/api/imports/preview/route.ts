import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { importPreviewRequestSchema } from '../../../data/validators'
import { buildImportPreview } from '../../../lib/import/buildPreview'
import { resolveImportRequestContext } from '../../importGuards'
import type { McaAssignmentMethod } from '../../../data/constants'

const logger = createLogger('merchant_advances')

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['merchant_advances.import.manage'] },
}

export async function POST(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    await resolveImportRequestContext(req)
    const payload = await req.json().catch(() => ({}))
    const input = importPreviewRequestSchema.parse(payload)
    if (input.source === 'xlsx' || input.source === 'xls') {
      return Response.json(
        { error: translate('merchant_advances.imports.errors.xlsxUnsupported', 'XLSX/XLS upload is not available yet. Use CSV or TSV.') },
        { status: 400 },
      )
    }
    if (input.source === 'zip' || input.source === 'gdrive' || input.source === 'email') {
      return Response.json(
        { error: translate('merchant_advances.imports.errors.sourceStub', 'This import source is not available yet. Upload a CSV or TSV spreadsheet.') },
        { status: 400 },
      )
    }

    const preview = buildImportPreview({
      source: input.source,
      spreadsheetText: input.spreadsheetText,
      filename: input.filename,
      columnMap: input.columnMap,
      files: input.files,
      assignmentMethod: input.assignmentMethod as McaAssignmentMethod | undefined,
      assigneeUserIds: input.assigneeUserIds,
      originatorDirectory: input.originatorDirectory,
      roundRobinCursorUserId: input.roundRobinCursorUserId,
      applicationTexts: input.applicationTexts,
    })

    return Response.json({
      dealCount: preview.dealCount,
      failureCount: preview.failureCount,
      headerRowIndex: preview.headerRowIndex,
      headers: preview.headers,
      suggestedColumnMap: preview.suggestedColumnMap,
      confirmedColumnMap: preview.confirmedColumnMap,
      unmappedHeaders: preview.unmappedHeaders,
      sensitiveHeaders: preview.sensitiveHeaders,
      rows: preview.rows,
      unmatchedFiles: preview.unmatchedFiles,
      assignmentMethod: preview.assignmentMethod,
      source: preview.source,
    })
  } catch (error) {
    if (isCrudHttpError(error)) {
      return Response.json(error.body, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: translate('merchant_advances.imports.errors.invalidPayload', 'Invalid import preview payload') },
        { status: 400 },
      )
    }
    logger.error('Import preview failed', { err: error })
    const message = error instanceof Error && error.message.startsWith('[internal]')
      ? translate('merchant_advances.imports.errors.previewFailed', 'Could not preview this spreadsheet')
      : translate('merchant_advances.imports.errors.previewFailed', 'Could not preview this spreadsheet')
    return Response.json({ error: message }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'Preview an MCA lead-package import',
  methods: {
    POST: {
      summary: 'Preview import',
      requestBody: {
        contentType: 'application/json',
        schema: importPreviewRequestSchema,
      },
      responses: [
        { status: 200, description: 'Review payload before create' },
        { status: 400, description: 'Invalid spreadsheet' },
        { status: 401, description: 'Unauthorized' },
      ],
    },
  },
}
