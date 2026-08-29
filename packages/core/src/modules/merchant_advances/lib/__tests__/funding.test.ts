import {
  createFundingFromOffer,
  FUNDING_SPLIT_POINTS_MISMATCH,
  splitPointsMatchParent,
} from '../funding'

const OWNER_ID = '11111111-1111-1111-1111-111111111111'
const REP_ID = '22222222-2222-2222-2222-222222222222'

describe('createFundingFromOffer', () => {
  it('uses weekday math for the 75000 x 1.32 / 6-month marketing example', () => {
    const result = createFundingFromOffer({
      amount: '75000',
      factor: '1.32',
      termMonths: 6,
      paymentFrequency: 'daily',
      commissionPoints: 10,
      ownerUserId: OWNER_ID,
    })

    expect(result.fundedAmount).toBe('75000.00')
    expect(result.paybackAmount).toBe('99000.00')
    expect(result.paymentAmount).toBe('785.71')
    expect(result.commissionAmount).toBe('7500.00')
    expect(result.commissionPoints).toBe('10')
    expect(result.splits).toEqual([
      { userId: OWNER_ID, role: 'owner', points: '10', amount: '7500.00' },
    ])
  })

  it('defaults extra-less splits to the deal owner at 100% of points', () => {
    const result = createFundingFromOffer({
      amount: '10000',
      factor: '1.20',
      termMonths: 4,
      paymentFrequency: 'monthly',
      commissionPoints: '8.5',
      ownerUserId: OWNER_ID,
    })

    expect(result.splits).toHaveLength(1)
    expect(result.splits[0]).toMatchObject({
      userId: OWNER_ID,
      role: 'owner',
      points: '8.5',
    })
    expect(result.splits[0]?.amount).toBe(result.commissionAmount)
  })

  it('requires extra split rows to sum to parent points and keeps remainder cents', () => {
    expect(splitPointsMatchParent(10, [{ points: 7 }, { points: 3 }])).toBe(true)
    expect(splitPointsMatchParent('10', [{ points: '6.25' }, { points: '3.75' }])).toBe(true)
    expect(splitPointsMatchParent(10, [{ points: 7 }, { points: 2 }])).toBe(false)

    const result = createFundingFromOffer(
      {
        amount: '75000',
        factor: '1.32',
        termMonths: 6,
        paymentFrequency: 'daily',
        commissionPoints: 10,
        ownerUserId: OWNER_ID,
      },
      {
        splits: [
          { userId: OWNER_ID, role: 'owner', points: 7 },
          { userId: REP_ID, role: 'rep', points: 3 },
        ],
      },
    )

    expect(result.splits).toEqual([
      { userId: OWNER_ID, role: 'owner', points: '7', amount: '5250.00' },
      { userId: REP_ID, role: 'rep', points: '3', amount: '2250.00' },
    ])
    const distributed = result.splits.reduce((sum, split) => sum + Number(split.amount), 0)
    expect(distributed.toFixed(2)).toBe(result.commissionAmount)
  })

  it('rejects split rows that do not sum to parent points', () => {
    expect(() => createFundingFromOffer(
      {
        amount: '75000',
        factor: '1.32',
        termMonths: 6,
        commissionPoints: 10,
      },
      { splits: [{ points: 6 }, { points: 3 }] },
    )).toThrow(FUNDING_SPLIT_POINTS_MISMATCH)
  })
})
