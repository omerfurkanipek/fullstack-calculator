import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/calculatorApi'
import { toDisplayMessage } from './errorMessages'

describe('toDisplayMessage', () => {
  it('maps known codes to short messages', () => {
    expect(toDisplayMessage(new ApiError('DIVISION_BY_ZERO', 'long server message'))).toBe('Cannot divide by zero')
    expect(toDisplayMessage(new ApiError('TIMEOUT', 'slow'))).toBe('Request timed out')
  })

  it('falls back to a generic message', () => {
    expect(toDisplayMessage(new ApiError('SOMETHING_NEW', 'x'))).toBe('Something went wrong')
    expect(toDisplayMessage(new Error('boom'))).toBe('Something went wrong')
  })
})
