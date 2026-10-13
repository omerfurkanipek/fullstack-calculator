import { useEffect, useReducer } from 'react'
import type { CalculatorApi } from '../../api/calculatorApi'
import { calculatorReducer, initialState } from './calculatorReducer'
import { toDisplayMessage } from './errorMessages'

/**
 * Binds the pure reducer to the API: whenever the reducer records a pending
 * calculation, run it and feed the outcome back. Clearing (or unmounting)
 * aborts the in-flight request.
 */
export function useCalculator(api: CalculatorApi) {
  const [state, dispatch] = useReducer(calculatorReducer, initialState)
  const { pending } = state

  useEffect(() => {
    if (!pending) return

    const controller = new AbortController()
    api
      .calculate(pending.request, controller.signal)
      .then((result) => dispatch({ type: 'resolved', id: pending.id, result }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        dispatch({ type: 'failed', id: pending.id, message: toDisplayMessage(error) })
      })

    return () => controller.abort()
  }, [api, pending])

  return { state, dispatch }
}
