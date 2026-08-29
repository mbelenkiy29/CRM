import { assertStageTransition, canTransition } from '../pipeline'

describe('merchant_advances pipeline', () => {
  it('allows new_app to underwriting', () => {
    expect(canTransition('new_app', 'underwriting')).toBe(true)
    expect(() => assertStageTransition('new_app', 'underwriting')).not.toThrow()
  })

  it('rejects funded to submitted', () => {
    expect(canTransition('funded', 'submitted')).toBe(false)
    expect(() => assertStageTransition('funded', 'submitted')).toThrow(/illegal MCA stage/)
  })
})
