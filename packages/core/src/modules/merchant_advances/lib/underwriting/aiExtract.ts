import { createLogger } from '@open-mercato/shared/lib/logger'
import { tryResolve } from '../tryResolve'
import { extractStatementMetrics, type StatementMetrics } from './extractStatement'

const logger = createLogger('merchant_advances').child({ component: 'statement-ai' })

export type StatementAiExtraction = {
  metrics: StatementMetrics
  model: string
  confidence: number | null
  notes: string | null
  source: 'ai' | 'deterministic'
}

export type StatementAiExtractor = {
  extractStatementMetrics?(markdown: string): Promise<Partial<StatementMetrics> & {
    model?: string
    confidence?: number | null
    notes?: string | null
  }>
}

type Resolver = { resolve: <R = unknown>(name: string) => R }

const METRIC_KEYS: Array<keyof StatementMetrics> = [
  'avgMonthlyRevenue',
  'avgDailyBalance',
  'depositCount',
  'nsfCount',
  'negativeDays',
  'existingPositions',
]

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function mergeMetrics(base: StatementMetrics, overlay: Partial<StatementMetrics>): StatementMetrics {
  const merged = { ...base }
  for (const key of METRIC_KEYS) {
    const candidate = overlay[key]
    if (isFiniteNumber(candidate)) merged[key] = candidate
  }
  return merged
}

function resolveExtractor(resolver: Resolver): StatementAiExtractor | undefined {
  return tryResolve<StatementAiExtractor>(resolver, 'mcaStatementAiExtractor')
    ?? tryResolve<StatementAiExtractor>(resolver, 'aiAssistantService')
}

export async function extractStatementWithOptionalAi(
  markdown: string,
  resolver?: Resolver | null,
): Promise<StatementAiExtraction> {
  const deterministic = extractStatementMetrics(markdown)
  const extractor = resolver ? resolveExtractor(resolver) : undefined
  if (!extractor?.extractStatementMetrics) {
    return {
      metrics: deterministic,
      model: 'deterministic-ocr',
      confidence: deterministic.avgMonthlyRevenue === null ? 0.2 : 0.7,
      notes: null,
      source: 'deterministic',
    }
  }

  try {
    const overlay = await extractor.extractStatementMetrics(markdown)
    return {
      metrics: mergeMetrics(deterministic, overlay),
      model: overlay.model?.trim() || 'ai-assistant',
      confidence: isFiniteNumber(overlay.confidence) ? overlay.confidence : 0.85,
      notes: overlay.notes?.trim() || null,
      source: 'ai',
    }
  } catch (error) {
    logger.warn('optional statement AI extractor failed; using deterministic OCR parse', {
      err: error instanceof Error ? error.message : error,
    })
    return {
      metrics: deterministic,
      model: 'deterministic-ocr',
      confidence: 0.55,
      notes: null,
      source: 'deterministic',
    }
  }
}
