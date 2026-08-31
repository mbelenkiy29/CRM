import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.deal.view'] },
}

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../assets')

function assetPath(kind: string | null): { file: string; type: string } {
  if (kind === 'captions') {
    return { file: path.join(ASSETS, 'getting-started.en.vtt'), type: 'text/vtt; charset=utf-8' }
  }
  return { file: path.join(ASSETS, 'getting-started.mp4'), type: 'video/mp4' }
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const { file, type } = assetPath(url.searchParams.get('kind'))
  if (!existsSync(file)) {
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('merchant_advances.errors.tourSaveFailed', 'Getting started media is missing.') },
      { status: 404 },
    )
  }
  const info = await stat(file)
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>
  return new Response(stream, {
    headers: {
      'content-type': type,
      'content-length': String(info.size),
      'cache-control': 'private, max-age=3600',
    },
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'MCA getting-started media',
  methods: {
    GET: {
      summary: 'Stream the getting-started video or captions',
      responses: [{ status: 200, description: 'MP4 or VTT.' }],
    },
  },
}
