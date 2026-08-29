import { assignRow, assignRows } from '../assign'

describe('assignRows', () => {
  const roster = ['user-a', 'user-b', 'user-c']

  it('round-robins from the workspace cursor', () => {
    const result = assignRows(
      [{ originatorValue: null }, { originatorValue: null }, { originatorValue: null }],
      {
        assignmentMethod: 'round_robin',
        originatorDirectory: [],
        assigneeUserIds: roster,
        roundRobinCursorUserId: 'user-a',
      },
    )
    expect(result.rows.map((row) => row.ownerUserId)).toEqual(['user-b', 'user-c', 'user-a'])
    expect(result.cursorUserId).toBe('user-a')
  })

  it('matches the Originator column to the directory', () => {
    const result = assignRow(
      {
        assignmentMethod: 'originator_column',
        originatorValue: 'Jane Doe',
        originatorDirectory: [
          { name: 'Jane Doe', userId: 'user-jane' },
          { name: 'Sam Rep', userId: 'user-sam' },
        ],
        assigneeUserIds: roster,
      },
      null,
    )
    expect(result.decision.ownerUserId).toBe('user-jane')
    expect(result.decision.failureReason).toBeNull()
  })

  it('fails when the originator cannot be matched', () => {
    const result = assignRow(
      {
        assignmentMethod: 'originator_column',
        originatorValue: 'Unknown Broker',
        originatorDirectory: [{ name: 'Jane Doe', userId: 'user-jane' }],
        assigneeUserIds: roster,
      },
      null,
    )
    expect(result.decision.failureReason).toBe('originator_unmatched')
  })
})
