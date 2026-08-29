import { planProtectedCopies } from '../protectCopy'

describe('merchant_advances document protection', () => {
  const originals = [
    { id: 'doc-1', attachmentId: 'att-1', classification: 'statement', isOriginal: true },
    { id: 'doc-2', attachmentId: 'att-2', classification: 'id', isOriginal: false },
  ]

  it('plans stamped copies and leaves originals untouched', () => {
    const copies = planProtectedCopies({
      originals,
      funderName: 'Harbor Advance',
      skipProtection: false,
      watermarkEnabled: true,
    })
    expect(copies).toHaveLength(1)
    expect(copies[0]?.sourceAttachmentId).toBe('att-1')
    expect(copies[0]?.stamped).toBe(true)
    expect(copies[0]?.stamp?.funderName).toBe('Harbor Advance')
    expect(originals[0]?.attachmentId).toBe('att-1')
  })

  it('skips protection when the funder requires unstamped statements', () => {
    const copies = planProtectedCopies({
      originals,
      funderName: 'Harbor Advance',
      skipProtection: true,
      watermarkEnabled: true,
    })
    expect(copies[0]?.stamped).toBe(false)
    expect(copies[0]?.stamp).toBeNull()
  })
})
