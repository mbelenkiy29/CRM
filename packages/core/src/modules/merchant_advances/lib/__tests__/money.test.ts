import { calculateCommission, calculatePayback, calculatePayment, splitCommissionAmounts } from '../money'

describe('merchant_advances money helpers', () => {
  it('calculates payback from amount and factor', () => {
    expect(calculatePayback('75000', '1.32')).toBe('99000.00')
  })

  it('calculates monthly and daily payments', () => {
    expect(calculatePayment('99000', 6, 'monthly')).toBe('16500.00')
    expect(calculatePayment('99000', 6, 'daily')).toBe('785.71')
  })

  it('calculates commission points on funded amount', () => {
    expect(calculateCommission('75000', 10)).toBe('7500.00')
  })

  it('splits commission amounts without losing cents', () => {
    expect(splitCommissionAmounts('7500', [7, 3])).toEqual(['5250.00', '2250.00'])
    expect(splitCommissionAmounts('100.00', [1, 1, 1])).toEqual(['33.33', '33.33', '33.34'])
  })
})
