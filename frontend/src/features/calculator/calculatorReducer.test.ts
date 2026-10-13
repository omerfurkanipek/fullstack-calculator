import { describe, expect, it } from 'vitest'
import {
  calculatorReducer,
  initialState,
  type CalculatorAction,
  type CalculatorState,
  type Digit,
} from './calculatorReducer'

const apply = (state: CalculatorState, ...actions: CalculatorAction[]) => actions.reduce(calculatorReducer, state)

/** Types a number such as "12.5" or "-3" key by key. */
const type = (state: CalculatorState, input: string): CalculatorState =>
  [...input].reduce<CalculatorState>((s, ch) => {
    if (ch === '.') return calculatorReducer(s, { type: 'decimal' })
    if (ch === '-') return calculatorReducer(s, { type: 'toggleSign' })
    return calculatorReducer(s, { type: 'digit', digit: ch as Digit })
  }, state)

/** Simulates the API answering the pending request. */
const resolve = (state: CalculatorState, result: number) => {
  expect(state.pending).not.toBeNull()
  return calculatorReducer(state, { type: 'resolved', id: state.pending!.id, result })
}

const fail = (state: CalculatorState, message: string) =>
  calculatorReducer(state, { type: 'failed', id: state.pending!.id, message })

describe('number entry', () => {
  it('starts at 0 and replaces the leading zero', () => {
    expect(initialState.entry).toBe('0')
    expect(type(initialState, '7').entry).toBe('7')
    expect(type(initialState, '007').entry).toBe('7')
  })

  it('appends digits and a single decimal point', () => {
    expect(type(initialState, '12.5').entry).toBe('12.5')
    expect(type(initialState, '1..2.').entry).toBe('1.2')
    expect(type(initialState, '.5').entry).toBe('0.5')
  })

  it('caps input at 15 digits', () => {
    const state = type(initialState, '1234567890123456789')
    expect(state.entry).toBe('123456789012345')
    expect(apply(state, { type: 'decimal' }).entry).toBe('123456789012345')
  })

  it('toggles the sign of the entry', () => {
    const negative = type(initialState, '42-')
    expect(negative.entry).toBe('-42')
    expect(apply(negative, { type: 'toggleSign' }).entry).toBe('42')
  })

  it('keeps typing after a negative zero', () => {
    expect(type(initialState, '-5').entry).toBe('-5')
  })

  it('backspaces typed digits but not results', () => {
    expect(apply(type(initialState, '123'), { type: 'backspace' }).entry).toBe('12')
    expect(apply(type(initialState, '7'), { type: 'backspace' }).entry).toBe('0')
    expect(apply(type(initialState, '7-'), { type: 'backspace' }).entry).toBe('0')
    expect(apply(initialState, { type: 'backspace' })).toEqual(initialState)
  })
})

describe('binary operations', () => {
  it('requests the calculation on equals and shows the result', () => {
    let state = apply(type(initialState, '12'), { type: 'operator', operator: 'add' })
    expect(state.expression).toBe('12 +')
    expect(state.overwrite).toBe(true)

    state = apply(type(state, '3'), { type: 'equals' })
    expect(state.pending?.request).toEqual({ operation: 'add', a: 12, b: 3 })
    expect(state.expression).toBe('12 + 3 =')

    state = resolve(state, 15)
    expect(state).toMatchObject({ entry: '15', operator: null, accumulator: null, pending: null })
  })

  it('chains operations left to right', () => {
    let state = apply(type(initialState, '2'), { type: 'operator', operator: 'add' })
    state = apply(type(state, '3'), { type: 'operator', operator: 'multiply' })
    expect(state.pending?.request).toEqual({ operation: 'add', a: 2, b: 3 })

    state = resolve(state, 5)
    expect(state).toMatchObject({ entry: '5', accumulator: 5, operator: 'multiply', expression: '5 ×' })

    state = apply(type(state, '4'), { type: 'equals' })
    expect(state.pending?.request).toEqual({ operation: 'multiply', a: 5, b: 4 })
  })

  it('replaces the operator when pressed twice without an operand', () => {
    const state = apply(
      type(initialState, '9'),
      { type: 'operator', operator: 'add' },
      { type: 'operator', operator: 'divide' },
    )
    expect(state).toMatchObject({ operator: 'divide', accumulator: 9, pending: null, expression: '9 ÷' })
  })

  it('reuses the shown value when equals follows an operator', () => {
    const state = apply(type(initialState, '5'), { type: 'operator', operator: 'add' }, { type: 'equals' })
    expect(state.pending?.request).toEqual({ operation: 'add', a: 5, b: 5 })
  })

  it('ignores equals without an operator', () => {
    const state = type(initialState, '5')
    expect(apply(state, { type: 'equals' })).toBe(state)
  })

  it('continues from a result with a new operator', () => {
    let state = apply(type(initialState, '6'), { type: 'operator', operator: 'multiply' })
    state = resolve(apply(type(state, '7'), { type: 'equals' }), 42)
    state = apply(state, { type: 'operator', operator: 'subtract' })
    expect(state).toMatchObject({ accumulator: 42, operator: 'subtract', expression: '42 −' })
  })

  it('starts a new number when typing after a result', () => {
    let state = apply(type(initialState, '6'), { type: 'operator', operator: 'multiply' })
    state = resolve(apply(type(state, '7'), { type: 'equals' }), 42)
    expect(type(state, '1').entry).toBe('1')
  })

  it('supports power as a binary operator', () => {
    const state = apply(type(initialState, '2'), { type: 'operator', operator: 'power' })
    expect(apply(type(state, '10'), { type: 'equals' }).pending?.request).toEqual({ operation: 'power', a: 2, b: 10 })
  })

  it('starts a negative right operand when ± follows an operator', () => {
    const state = apply(type(initialState, '5'), { type: 'operator', operator: 'add' }, { type: 'toggleSign' })
    expect(state.entry).toBe('-0')
    expect(apply(type(state, '3'), { type: 'equals' }).pending?.request).toEqual({ operation: 'add', a: 5, b: -3 })
  })

  it('negates a result without making it editable', () => {
    let state = apply(type(initialState, '6'), { type: 'operator', operator: 'multiply' })
    state = apply(resolve(apply(type(state, '7'), { type: 'equals' }), 42), { type: 'toggleSign' })
    expect(state.entry).toBe('-42')
    expect(type(state, '1').entry).toBe('1')
  })

  it('sends negative operands', () => {
    const state = apply(type(initialState, '3'), { type: 'operator', operator: 'subtract' })
    expect(apply(type(state, '4-'), { type: 'equals' }).pending?.request).toEqual({ operation: 'subtract', a: 3, b: -4 })
  })
})

describe('unary operations', () => {
  it('computes the square root of the entry', () => {
    let state = apply(type(initialState, '81'), { type: 'sqrt' })
    expect(state.pending?.request).toEqual({ operation: 'sqrt', a: 81 })
    expect(state.expression).toBe('√(81)')
    state = resolve(state, 9)
    expect(state).toMatchObject({ entry: '9', overwrite: true })
  })

  it('uses a square root result as the pending right operand', () => {
    let state = apply(type(initialState, '5'), { type: 'operator', operator: 'add' })
    state = apply(type(state, '9'), { type: 'sqrt' })
    expect(state.expression).toBe('5 + √(9)')
    state = resolve(state, 3)
    state = apply(state, { type: 'equals' })
    expect(state.pending?.request).toEqual({ operation: 'add', a: 5, b: 3 })
  })

  it('chains after sqrt on the right operand when an operator is pressed', () => {
    let state = apply(type(initialState, '5'), { type: 'operator', operator: 'add' })
    state = resolve(apply(type(state, '9'), { type: 'sqrt' }), 3)
    state = apply(state, { type: 'operator', operator: 'multiply' })
    expect(state.pending?.request).toEqual({ operation: 'add', a: 5, b: 3 })
  })

  it('converts a standalone percent to a fraction', () => {
    const state = apply(type(initialState, '10'), { type: 'percent' })
    expect(state.pending?.request).toEqual({ operation: 'percentage', a: 10, b: 1 })
    expect(state.expression).toBe('10%')
  })

  it('takes a percent of the accumulator after + or −', () => {
    const state = apply(type(initialState, '200'), { type: 'operator', operator: 'add' })
    const next = apply(type(state, '10'), { type: 'percent' })
    expect(next.pending?.request).toEqual({ operation: 'percentage', a: 10, b: 200 })
    expect(next.expression).toBe('200 + 10% of 200')
  })

  it('uses a plain fraction for percent after × or ÷', () => {
    const state = apply(type(initialState, '200'), { type: 'operator', operator: 'multiply' })
    expect(apply(type(state, '10'), { type: 'percent' }).pending?.request).toEqual({
      operation: 'percentage',
      a: 10,
      b: 1,
    })
  })
})

describe('async lifecycle', () => {
  const inFlight = () => apply(type(initialState, '1'), { type: 'operator', operator: 'divide' }, { type: 'digit', digit: '0' }, { type: 'equals' })

  it('ignores input while a request is pending', () => {
    const state = inFlight()
    expect(apply(state, { type: 'digit', digit: '5' }, { type: 'operator', operator: 'add' }, { type: 'sqrt' })).toBe(state)
  })

  it('assigns increasing request ids', () => {
    const first = inFlight()
    const second = apply(resolve(first, 1), { type: 'sqrt' })
    expect(second.pending!.id).toBeGreaterThan(first.pending!.id)
  })

  it('ignores stale responses', () => {
    const state = inFlight()
    const stale = { type: 'resolved', id: state.pending!.id + 99, result: 1 } as const
    expect(calculatorReducer(state, stale)).toBe(state)
  })

  it('cancels the pending request on clear', () => {
    const cleared = apply(inFlight(), { type: 'clear' })
    expect(cleared).toMatchObject({ ...initialState, nextRequestId: cleared.nextRequestId })
    expect(cleared.nextRequestId).toBeGreaterThan(initialState.nextRequestId)
  })

  it('shows an error and recovers on the next digit', () => {
    const errored = fail(inFlight(), 'Cannot divide by zero')
    expect(errored).toMatchObject({ error: 'Cannot divide by zero', pending: null })

    // Operators and functions are ignored while the error is shown.
    expect(apply(errored, { type: 'operator', operator: 'add' }, { type: 'sqrt' }, { type: 'toggleSign' })).toBe(errored)

    expect(type(errored, '7')).toMatchObject({ entry: '7', error: null, operator: null, expression: '' })
    expect(type(errored, '.')).toMatchObject({ entry: '0.', error: null })
  })
})
