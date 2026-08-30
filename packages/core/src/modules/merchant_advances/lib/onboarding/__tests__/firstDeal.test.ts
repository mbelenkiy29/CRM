import { applyFirstDealChecklist, firstDealWouldSubmit } from '../firstDeal'
import { EMPTY_ONBOARDING_FIRST_DEAL } from '../types'

describe('merchant_advances first-deal checklist', () => {
  it('never auto-submits when creating, scoring, or selecting funders', () => {
    expect(firstDealWouldSubmit('ensure')).toBe(false)
    expect(firstDealWouldSubmit('score')).toBe(false)
    expect(firstDealWouldSubmit('select')).toBe(false)
    expect(firstDealWouldSubmit('reply')).toBe(false)
    expect(firstDealWouldSubmit('skip')).toBe(false)
    const selected = applyFirstDealChecklist(EMPTY_ONBOARDING_FIRST_DEAL, 'select', [
      '018f1a2b-3c4d-4000-8000-000000000011',
      '018f1a2b-3c4d-4000-8000-000000000012',
    ])
    expect(selected.selectedFunderIds).toHaveLength(2)
    expect(selected.submitted).toBe(false)
  })

  it('submits only when the submit action is explicit', () => {
    expect(firstDealWouldSubmit('submit')).toBe(true)
    const submitted = applyFirstDealChecklist(EMPTY_ONBOARDING_FIRST_DEAL, 'submit')
    expect(submitted.submitted).toBe(true)
  })
})
