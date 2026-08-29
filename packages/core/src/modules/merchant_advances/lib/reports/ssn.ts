const SSN_SHAPED = /\b\d{3}-\d{2}-\d{4}\b/g

export function stripSsnShapedValues(value: string): string {
  return value.replace(SSN_SHAPED, '[redacted]')
}

export function csvEscape(value: string): string {
  const cleaned = stripSsnShapedValues(value)
  if (/[",\n]/.test(cleaned)) return `"${cleaned.replace(/"/g, '""')}"`
  return cleaned
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [
    headers.map((header) => csvEscape(header)).join(','),
    ...rows.map((row) => row.map((cell) => csvEscape(cell == null ? '' : String(cell))).join(',')),
  ]
  return `${lines.join('\n')}\n`
}
