export function toCents(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  if (!Number.isFinite(numeric)) return 0
  return Math.round(numeric * 100)
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const fraction = String(abs % 100).padStart(2, '0')
  return `${sign}${whole}.${fraction}`
}

export function ratio(numerator: number, denominator: number): string {
  if (!denominator) return '0.00'
  return (Math.round((numerator * 10000) / denominator) / 100).toFixed(2)
}
