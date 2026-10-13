import { describe, expect, it } from 'vitest'
import { countDigits, formatForDisplay, formatResult } from './format'

describe('formatResult', () => {
  it.each([
    [0, '0'],
    [-0, '0'],
    [15, '15'],
    [-2.5, '-2.5'],
    [0.333333333333333, '0.333333333333333'],
    [123456789012345, '123456789012345'],
    [1e15, '1e+15'],
    [1.5e20, '1.5e+20'],
    [-2.25e-12, '-2.25e-12'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatResult(value)).toBe(expected)
  })
})

describe('formatForDisplay', () => {
  it.each([
    ['0', '0'],
    ['999', '999'],
    ['1000', '1,000'],
    ['-1234567.891', '-1,234,567.891'],
    ['12.', '12.'],
    ['1.5e+20', '1.5e+20'],
  ])('displays %s as %s', (entry, expected) => {
    expect(formatForDisplay(entry)).toBe(expected)
  })
})

describe('countDigits', () => {
  it('ignores sign and decimal point', () => {
    expect(countDigits('-12.34')).toBe(4)
  })
})
