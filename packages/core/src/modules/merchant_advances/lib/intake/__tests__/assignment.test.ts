import { pickRoundRobinOwner } from '../assignment'

describe('merchant_advances intake assignment', () => {
  const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const userC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

  it('starts at the first sorted id when no cursor exists', () => {
    expect(pickRoundRobinOwner([userC, userA, userB], null)).toEqual({
      ownerUserId: userA,
      nextCursorUserId: userA,
    })
  })

  it('advances past the cursor and wraps around', () => {
    expect(pickRoundRobinOwner([userA, userB, userC], userA)).toEqual({
      ownerUserId: userB,
      nextCursorUserId: userB,
    })
    expect(pickRoundRobinOwner([userA, userB, userC], userC)).toEqual({
      ownerUserId: userA,
      nextCursorUserId: userA,
    })
  })

  it('returns no owner when the roster is empty', () => {
    expect(pickRoundRobinOwner([], userA)).toEqual({
      ownerUserId: null,
      nextCursorUserId: userA,
    })
  })
})
