import type { CalculatorAction, Digit, Operator } from './calculatorReducer'

const OPERATOR_KEYS: Record<string, Operator> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  x: 'multiply',
  '/': 'divide',
  '^': 'power',
}

/** Maps a KeyboardEvent.key to a calculator action, or null if unbound. */
export function keyToAction(key: string): CalculatorAction | null {
  if (/^[0-9]$/.test(key)) return { type: 'digit', digit: key as Digit }
  if (key in OPERATOR_KEYS) return { type: 'operator', operator: OPERATOR_KEYS[key] }

  switch (key) {
    case '.':
    case ',':
      return { type: 'decimal' }
    case '=':
    case 'Enter':
      return { type: 'equals' }
    case '%':
      return { type: 'percent' }
    case 'r':
      return { type: 'sqrt' }
    case 'n':
      return { type: 'toggleSign' }
    case 'Backspace':
      return { type: 'backspace' }
    case 'Escape':
    case 'Delete':
    case 'c':
      return { type: 'clear' }
    default:
      return null
  }
}
