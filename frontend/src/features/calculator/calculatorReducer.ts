import type { CalculationRequest } from '../../api/calculatorApi'
import { countDigits, formatResult, MAX_DIGITS } from './format'

/**
 * Pure state machine for an immediate-execution calculator (like a pocket or
 * phone calculator: `2 + 3 × 4 =` evaluates left to right to 20).
 *
 * The reducer never performs I/O. When arithmetic is needed it records a
 * `pending` request describing the call and what to do with the result;
 * `useCalculator` executes it and dispatches `resolved` / `failed`. This keeps
 * every transition synchronous and unit-testable.
 */

export type Operator = 'add' | 'subtract' | 'multiply' | 'divide' | 'power'
export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

export const OPERATOR_SYMBOLS: Record<Operator, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  power: '^',
}

/** What to do with the API result once it arrives. */
export type Continuation =
  | { kind: 'equals' }
  | { kind: 'chain'; operator: Operator }
  | { kind: 'replaceEntry' }

export interface PendingCalculation {
  id: number
  request: CalculationRequest
  then: Continuation
}

export interface CalculatorState {
  /** Raw text of the number currently shown. */
  entry: string
  /** Left-hand operand awaiting `operator`. */
  accumulator: number | null
  operator: Operator | null
  /** True once the user has supplied a right-hand operand for `operator`. */
  hasOperand: boolean
  /** True when the next digit should replace `entry` instead of appending. */
  overwrite: boolean
  /** Secondary line, e.g. "12 × 3 =". */
  expression: string
  error: string | null
  pending: PendingCalculation | null
  /** Monotonic id so stale responses can be ignored. */
  nextRequestId: number
}

export type CalculatorAction =
  | { type: 'digit'; digit: Digit }
  | { type: 'decimal' }
  | { type: 'operator'; operator: Operator }
  | { type: 'equals' }
  | { type: 'sqrt' }
  | { type: 'percent' }
  | { type: 'toggleSign' }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'resolved'; id: number; result: number }
  | { type: 'failed'; id: number; message: string }

export const initialState: CalculatorState = {
  entry: '0',
  accumulator: null,
  operator: null,
  hasOperand: false,
  overwrite: true,
  expression: '',
  error: null,
  pending: null,
  nextRequestId: 1,
}

const toNumber = (entry: string): number => Number(entry)

function request(state: CalculatorState, req: CalculationRequest, then: Continuation, expression: string): CalculatorState {
  return {
    ...state,
    expression,
    pending: { id: state.nextRequestId, request: req, then },
    nextRequestId: state.nextRequestId + 1,
  }
}

function inputDigit(state: CalculatorState, digit: Digit): CalculatorState {
  if (state.error) return { ...initialState, nextRequestId: state.nextRequestId, entry: digit, overwrite: false }
  const hasOperand = state.operator ? true : state.hasOperand
  if (state.overwrite) return { ...state, entry: digit, overwrite: digit === '0', hasOperand }
  if (state.entry === '0') return { ...state, entry: digit, hasOperand }
  if (state.entry === '-0') return { ...state, entry: `-${digit}`, hasOperand }
  if (countDigits(state.entry) >= MAX_DIGITS) return state
  return { ...state, entry: state.entry + digit, hasOperand }
}

function inputDecimal(state: CalculatorState): CalculatorState {
  if (state.error) return { ...initialState, nextRequestId: state.nextRequestId, entry: '0.', overwrite: false }
  const hasOperand = state.operator ? true : state.hasOperand
  if (state.overwrite) return { ...state, entry: '0.', overwrite: false, hasOperand }
  if (state.entry.includes('.') || countDigits(state.entry) >= MAX_DIGITS) return state
  return { ...state, entry: `${state.entry}.`, hasOperand }
}

function inputOperator(state: CalculatorState, operator: Operator): CalculatorState {
  if (state.operator && state.hasOperand && state.accumulator !== null) {
    const a = state.accumulator
    const b = toNumber(state.entry)
    return request(
      state,
      { operation: state.operator, a, b },
      { kind: 'chain', operator },
      `${formatResult(a)} ${OPERATOR_SYMBOLS[state.operator]} ${formatResult(b)}`,
    )
  }
  // No right-hand operand yet: start a new expression or change the operator.
  const accumulator = state.operator && state.accumulator !== null ? state.accumulator : toNumber(state.entry)
  return {
    ...state,
    accumulator,
    operator,
    hasOperand: false,
    overwrite: true,
    expression: `${formatResult(accumulator)} ${OPERATOR_SYMBOLS[operator]}`,
  }
}

function inputEquals(state: CalculatorState): CalculatorState {
  if (!state.operator || state.accumulator === null) return state
  const a = state.accumulator
  // "5 + =" reuses the shown value as the right operand, giving 10.
  const b = toNumber(state.entry)
  return request(
    state,
    { operation: state.operator, a, b },
    { kind: 'equals' },
    `${formatResult(a)} ${OPERATOR_SYMBOLS[state.operator]} ${formatResult(b)} =`,
  )
}

function prefix(state: CalculatorState): string {
  return state.operator && state.accumulator !== null
    ? `${formatResult(state.accumulator)} ${OPERATOR_SYMBOLS[state.operator]} `
    : ''
}

function inputSqrt(state: CalculatorState): CalculatorState {
  const a = toNumber(state.entry)
  return request(state, { operation: 'sqrt', a }, { kind: 'replaceEntry' }, `${prefix(state)}√(${formatResult(a)})`)
}

/**
 * Percent follows common calculator semantics:
 * - after + or −, `200 + 10 %` means 10% of 200 (→ 20), so `=` gives 220;
 * - otherwise it converts the entry to a fraction (`10 %` → 0.1).
 */
function inputPercent(state: CalculatorState): CalculatorState {
  const a = toNumber(state.entry)
  const relative = (state.operator === 'add' || state.operator === 'subtract') && state.accumulator !== null
  const b = relative ? (state.accumulator as number) : 1
  const label = relative ? `${formatResult(a)}% of ${formatResult(b)}` : `${formatResult(a)}%`
  return request(state, { operation: 'percentage', a, b }, { kind: 'replaceEntry' }, `${prefix(state)}${label}`)
}

function toggleSign(state: CalculatorState): CalculatorState {
  // Right after an operator, ± starts typing a negative right operand.
  if (state.operator && !state.hasOperand) return { ...state, entry: '-0', overwrite: false, hasOperand: true }
  const entry = state.entry.startsWith('-') ? state.entry.slice(1) : `-${state.entry}`
  // Keep "-0" editable so the next digit extends it instead of replacing it.
  return { ...state, entry, overwrite: entry === '-0' ? false : state.overwrite }
}

function backspace(state: CalculatorState): CalculatorState {
  if (state.overwrite) return state
  const entry = state.entry.slice(0, -1)
  return { ...state, entry: entry === '' || entry === '-' ? '0' : entry }
}

function resolve(state: CalculatorState, result: number): CalculatorState {
  const entry = formatResult(result)
  const base = { ...state, pending: null, entry, overwrite: true }
  const { then } = state.pending as PendingCalculation

  switch (then.kind) {
    case 'equals':
      return { ...base, accumulator: null, operator: null, hasOperand: false }
    case 'chain':
      return {
        ...base,
        accumulator: result,
        operator: then.operator,
        hasOperand: false,
        expression: `${entry} ${OPERATOR_SYMBOLS[then.operator]}`,
      }
    case 'replaceEntry':
      // The computed value becomes the operand for any pending operator.
      return { ...base, hasOperand: state.operator ? true : state.hasOperand }
  }
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  if (action.type === 'clear') return { ...initialState, nextRequestId: state.nextRequestId }

  if (action.type === 'resolved' || action.type === 'failed') {
    if (state.pending?.id !== action.id) return state // stale or cancelled
    return action.type === 'resolved'
      ? resolve(state, action.result)
      : { ...state, pending: null, error: action.message }
  }

  // Ignore input while a calculation is in flight to keep ordering deterministic.
  if (state.pending) return state

  switch (action.type) {
    case 'digit':
      return inputDigit(state, action.digit)
    case 'decimal':
      return inputDecimal(state)
  }

  // Remaining actions operate on a valid number; after an error only digits or clear apply.
  if (state.error) return state

  switch (action.type) {
    case 'operator':
      return inputOperator(state, action.operator)
    case 'equals':
      return inputEquals(state)
    case 'sqrt':
      return inputSqrt(state)
    case 'percent':
      return inputPercent(state)
    case 'toggleSign':
      return toggleSign(state)
    case 'backspace':
      return backspace(state)
  }
}
