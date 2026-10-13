/** Mirrors the backend precision: float64 round-trips 15 significant digits. */
export const MAX_DIGITS = 15

const EXPONENT_UPPER = 1e15
const EXPONENT_LOWER = 1e-9

/** Converts an API result into the raw entry string the calculator edits. */
export function formatResult(value: number): string {
  if (value === 0) return '0' // also normalises -0
  const abs = Math.abs(value)
  if (abs >= EXPONENT_UPPER || abs < EXPONENT_LOWER) {
    // Trim trailing zeros in the mantissa: 1.500000000e+20 -> 1.5e+20
    return value.toExponential(MAX_DIGITS - 6).replace(/\.?0+e/, 'e')
  }
  return String(value)
}

/** Adds thousands separators to the integer part for display only. */
export function formatForDisplay(entry: string): string {
  if (entry.includes('e')) return entry
  const negative = entry.startsWith('-')
  const unsigned = negative ? entry.slice(1) : entry
  const [integer, fraction] = unsigned.split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped}${fraction !== undefined ? `.${fraction}` : ''}`
}

/** Counts digits only, ignoring sign and decimal point. */
export function countDigits(entry: string): number {
  return entry.replace(/[^0-9]/g, '').length
}
