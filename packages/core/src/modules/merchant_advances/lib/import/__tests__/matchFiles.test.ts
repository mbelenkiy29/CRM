import { matchFilesToRows } from '../matchFiles'

describe('matchFilesToRows', () => {
  it('matches folder names to business names with punctuation and suffixes', () => {
    const result = matchFilesToRows(
      [
        { rowIndex: 1, businessName: 'Acme LLC', folderName: null },
        { rowIndex: 2, businessName: 'Harbor Auto Repair Inc', folderName: null },
      ],
      [
        { path: 'Acme_LLC/bank_statement.pdf', name: 'bank_statement.pdf' },
        { path: 'Harbor Auto Repair/application.pdf', name: 'application.pdf' },
        { path: 'Unknown Shop/id.jpg', name: 'id.jpg' },
      ],
    )
    expect(result.matches.get(1)?.map((file) => file.path)).toEqual(['Acme_LLC/bank_statement.pdf'])
    expect(result.matches.get(2)?.map((file) => file.path)).toEqual(['Harbor Auto Repair/application.pdf'])
    expect(result.unmatched.map((file) => file.path)).toEqual(['Unknown Shop/id.jpg'])
  })

  it('prefers an explicit folder column over the business name', () => {
    const result = matchFilesToRows(
      [{ rowIndex: 0, businessName: 'Legal Name Inc', folderName: 'Packet 42' }],
      [{ path: 'Packet 42/more_stips.pdf', name: 'more_stips.pdf' }],
    )
    expect(result.matches.get(0)).toHaveLength(1)
    expect(result.unmatched).toEqual([])
  })
})
