import { ApiError, CLIENT_ERROR_CODES } from '../../api/calculatorApi'

/** Short, display-sized messages for known error codes. */
const MESSAGES: Record<string, string> = {
  DIVISION_BY_ZERO: 'Cannot divide by zero',
  NEGATIVE_SQUARE_ROOT: 'Invalid input for √',
  UNDEFINED_RESULT: 'Not a real number',
  RESULT_OUT_OF_RANGE: 'Result too large',
  INVALID_OPERAND: 'Invalid number',
  [CLIENT_ERROR_CODES.network]: 'Service unavailable',
  [CLIENT_ERROR_CODES.timeout]: 'Request timed out',
}

export function toDisplayMessage(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? 'Something went wrong'
  return 'Something went wrong'
}
