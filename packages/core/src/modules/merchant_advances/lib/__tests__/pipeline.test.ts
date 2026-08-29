import { applyLegalPath, assertStageTransition, canTransition, legalMoves, shortestLegalPath } from '../pipeline'

describe('merchant_advances pipeline', () => {
  it('allows new_app to underwriting', () => {
    expect(canTransition('new_app', 'underwriting')).toBe(true)
    expect(() => assertStageTransition('new_app', 'underwriting')).not.toThrow()
  })

  it('rejects funded to submitted', () => {
    expect(canTransition('funded', 'submitted')).toBe(false)
    expect(() => assertStageTransition('funded', 'submitted')).toThrow(/illegal MCA stage/)
  })

  it('lists legal moves without mutating the table', () => {
    expect(legalMoves('offered')).toEqual(['contracted', 'funded', 'declined', 'dead', 'submitted'])
    expect(legalMoves('funded')).toEqual(['dead'])
  })

  it('walks new_app to offered along legal hops so a manual offer can be accepted', () => {
    const path = shortestLegalPath('new_app', 'offered')
    expect(path).toEqual(['underwriting', 'submitted', 'offered'])
    expect(applyLegalPath('new_app', path ?? [])).toBe('offered')
    expect(canTransition('offered', 'funded')).toBe(true)
  })

  it('returns an empty path when already at the target', () => {
    expect(shortestLegalPath('offered', 'offered')).toEqual([])
  })

  it('rejects a direct funded to submitted hop even though a long cycle exists', () => {
    expect(canTransition('funded', 'submitted')).toBe(false)
    expect(() => applyLegalPath('funded', ['submitted'])).toThrow(/illegal MCA stage/)
  })
})
