import { useEffect } from 'react'
import type { CalculatorApi } from '../../../api/calculatorApi'
import { keyToAction } from '../keymap'
import { useCalculator } from '../useCalculator'
import { Display } from './Display'
import { Keypad } from './Keypad'

interface CalculatorProps {
  api: CalculatorApi
}

export function Calculator({ api }: CalculatorProps) {
  const { state, dispatch } = useCalculator(api)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const action = keyToAction(event.key)
      if (!action) return
      // Stops Enter from also "clicking" a focused key.
      event.preventDefault()
      dispatch(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch])

  // Highlight the operator only while it is waiting for its right operand.
  const activeOperator = state.operator && !state.hasOperand && !state.pending ? state.operator : null

  return (
    <section className="calculator" aria-label="Calculator">
      <Display
        expression={state.expression}
        entry={state.entry}
        error={state.error}
        loading={state.pending !== null}
      />
      <Keypad onAction={dispatch} activeOperator={activeOperator} />
    </section>
  )
}
