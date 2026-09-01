import {
  mergeCriteriaListTokens,
  parseCriteriaListTokens,
  splitCriteriaListCommaDraft,
} from '../parseListField'

describe('merchant_advances onboarding criteria list parse', () => {
  it('splits "Auto repair, restaurants" into two tokens', () => {
    expect(parseCriteriaListTokens('Auto repair, restaurants')).toEqual([
      'Auto repair',
      'restaurants',
    ])
  })

  it('keeps spaces inside a token and trims around commas', () => {
    expect(parseCriteriaListTokens('  Auto repair  ,  restaurants  ')).toEqual([
      'Auto repair',
      'restaurants',
    ])
    expect(parseCriteriaListTokens('TX, FL')).toEqual(['TX', 'FL'])
  })

  it('drops empty fragments', () => {
    expect(parseCriteriaListTokens('')).toEqual([])
    expect(parseCriteriaListTokens('   ')).toEqual([])
    expect(parseCriteriaListTokens('Auto repair,')).toEqual(['Auto repair'])
    expect(parseCriteriaListTokens(',restaurants')).toEqual(['restaurants'])
    expect(parseCriteriaListTokens('a,,b')).toEqual(['a', 'b'])
  })

  it('commits complete tokens on comma while keeping the trailing draft', () => {
    expect(splitCriteriaListCommaDraft('Auto repair, restaurants')).toEqual({
      complete: ['Auto repair'],
      draft: 'restaurants',
    })
    expect(splitCriteriaListCommaDraft('Auto repair,')).toEqual({
      complete: ['Auto repair'],
      draft: '',
    })
    expect(splitCriteriaListCommaDraft('Auto repair')).toEqual({
      complete: [],
      draft: 'Auto repair',
    })
  })

  it('does not drop in-progress spaces before a comma is typed', () => {
    expect(splitCriteriaListCommaDraft('Auto ')).toEqual({
      complete: [],
      draft: 'Auto ',
    })
  })

  it('merges unique tokens without changing FunderCriteria shape', () => {
    expect(mergeCriteriaListTokens(['Auto repair'], ['restaurants', 'Auto repair'])).toEqual([
      'Auto repair',
      'restaurants',
    ])
  })
})
