import { classifyFileName } from '../classifyFile'

describe('classifyFileName', () => {
  it('classifies statements, applications, IDs, checks, tax returns, and stips', () => {
    expect(classifyFileName('Chase_statement_Jan.pdf')).toBe('statement')
    expect(classifyFileName('MCA_Application.pdf')).toBe('application')
    expect(classifyFileName('drivers_license.jpg')).toBe('id')
    expect(classifyFileName('voided_check.png')).toBe('voided_check')
    expect(classifyFileName('2023_tax_return.pdf')).toBe('tax_return')
    expect(classifyFileName('more_stips.zip')).toBe('other_stip')
  })

  it('defaults unknown files to other_stip', () => {
    expect(classifyFileName('scan-0042.heic')).toBe('other_stip')
  })
})
