import { extractStatementWithOptionalAi } from '../aiExtract'

describe('extractStatementWithOptionalAi', () => {
  const markdown = 'Average Monthly Revenue: $10,000\nNSF Count: 1'

  it('parses deterministically when AI assistant is missing', async () => {
    const result = await extractStatementWithOptionalAi(markdown, {
      resolve: () => {
        throw new Error('[internal] missing')
      },
    })
    expect(result.source).toBe('deterministic')
    expect(result.model).toBe('deterministic-ocr')
    expect(result.metrics.avgMonthlyRevenue).toBe(10000)
    expect(result.metrics.nsfCount).toBe(1)
  })

  it('merges optional AI overlay onto the OCR parse', async () => {
    const result = await extractStatementWithOptionalAi(markdown, {
      resolve: (name: string) => {
        if (name !== 'aiAssistantService') throw new Error('[internal] missing')
        return {
          extractStatementMetrics: async () => ({
            avgDailyBalance: 2500,
            model: 'test-model',
            confidence: 0.9,
            notes: 'AI overlay',
          }),
        }
      },
    })
    expect(result.source).toBe('ai')
    expect(result.model).toBe('test-model')
    expect(result.metrics.avgMonthlyRevenue).toBe(10000)
    expect(result.metrics.avgDailyBalance).toBe(2500)
    expect(result.notes).toBe('AI overlay')
  })

  it('falls back to OCR when the optional AI extractor throws', async () => {
    const result = await extractStatementWithOptionalAi(markdown, {
      resolve: () => ({
        extractStatementMetrics: async () => {
          throw new Error('[internal] model unavailable')
        },
      }),
    })
    expect(result.source).toBe('deterministic')
    expect(result.metrics.avgMonthlyRevenue).toBe(10000)
  })
})
