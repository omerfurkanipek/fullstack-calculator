import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError, type CalculationRequest, type CalculatorApi } from '../../../api/calculatorApi'
import { Calculator } from './Calculator'

/** Fake API that evaluates locally so the UI can be tested end to end. */
function createFakeApi(): CalculatorApi & { calculate: ReturnType<typeof vi.fn> } {
  const calculate = vi.fn(async (req: CalculationRequest) => {
    switch (req.operation) {
      case 'add':
        return req.a + req.b
      case 'subtract':
        return req.a - req.b
      case 'multiply':
        return req.a * req.b
      case 'divide':
        if (req.b === 0) throw new ApiError('DIVISION_BY_ZERO', 'Division by zero is not allowed.', 422)
        return req.a / req.b
      case 'power':
        return req.a ** req.b
      case 'percentage':
        return (req.a * req.b) / 100
      case 'sqrt':
        if (req.a < 0) throw new ApiError('NEGATIVE_SQUARE_ROOT', 'Negative.', 422)
        return Math.sqrt(req.a)
    }
  })
  return { calculate }
}

const display = () => screen.getByTestId('display-value')
const expression = () => screen.getByTestId('expression')

async function press(user: ReturnType<typeof userEvent.setup>, ...labels: string[]) {
  for (const label of labels) {
    await user.click(screen.getByRole('button', { name: label }))
  }
}

function setup(api: CalculatorApi = createFakeApi()) {
  const user = userEvent.setup()
  render(<Calculator api={api} />)
  return { user, api }
}

describe('<Calculator />', () => {
  it('evaluates an expression through the API', async () => {
    const { user, api } = setup()

    await press(user, '1', '2', 'Add', '3', 'Equals')

    await waitFor(() => expect(display()).toHaveTextContent('15'))
    expect(expression()).toHaveTextContent('12 + 3 =')
    expect(api.calculate).toHaveBeenCalledWith({ operation: 'add', a: 12, b: 3 }, expect.any(AbortSignal))
  })

  it('chains operations left to right', async () => {
    const { user } = setup()

    await press(user, '2', 'Add', '3', 'Multiply')
    await waitFor(() => expect(expression()).toHaveTextContent('5 ×'))
    await press(user, '4', 'Equals')

    await waitFor(() => expect(display()).toHaveTextContent('20'))
  })

  it('highlights the active operator', async () => {
    const { user } = setup()

    await press(user, '8', 'Divide')

    expect(screen.getByRole('button', { name: 'Divide' })).toHaveAttribute('aria-pressed', 'true')
    await press(user, '2')
    expect(screen.getByRole('button', { name: 'Divide' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a friendly message for division by zero and recovers', async () => {
    const { user } = setup()

    await press(user, '7', 'Divide', '0', 'Equals')
    await waitFor(() => expect(display()).toHaveTextContent('Cannot divide by zero'))

    await press(user, '4')
    expect(display()).toHaveTextContent('4')
  })

  it('computes square roots, powers and percentages', async () => {
    const { user } = setup()

    await press(user, '8', '1', 'Square root')
    await waitFor(() => expect(display()).toHaveTextContent('9'))

    await press(user, 'All clear', '2', 'Power', '1', '0', 'Equals')
    await waitFor(() => expect(display()).toHaveTextContent('1,024'))

    await press(user, 'All clear', '2', '0', '0', 'Add', '1', '0', 'Percent')
    await waitFor(() => expect(display()).toHaveTextContent('20'))
    await press(user, 'Equals')
    await waitFor(() => expect(display()).toHaveTextContent('220'))
  })

  it('supports keyboard input', async () => {
    const { user } = setup()

    await user.keyboard('9*4{Enter}')
    await waitFor(() => expect(display()).toHaveTextContent('36'))

    await user.keyboard('{Escape}')
    expect(display()).toHaveTextContent('0')
  })

  it('ignores shortcuts with modifier keys', async () => {
    const { user } = setup()

    await user.keyboard('5{Meta>}c{/Meta}')
    expect(display()).toHaveTextContent('5')
  })

  it('shows a service error when the API is unreachable', async () => {
    const api = { calculate: vi.fn().mockRejectedValue(new ApiError('NETWORK_ERROR', 'down')) }
    const { user } = setup(api)

    await press(user, '1', 'Add', '1', 'Equals')

    await waitFor(() => expect(display()).toHaveTextContent('Service unavailable'))
  })

  it('aborts the in-flight request when cleared', async () => {
    let signal: AbortSignal | undefined
    const api = {
      calculate: vi.fn((_req: CalculationRequest, s?: AbortSignal) => {
        signal = s
        return new Promise<number>(() => {})
      }),
    }
    const { user } = setup(api)

    await press(user, '1', 'Add', '1', 'Equals')
    expect(screen.getByLabelText(/Result/).closest('.display')).toHaveAttribute('aria-busy', 'true')

    await press(user, 'All clear')

    expect(signal?.aborted).toBe(true)
    expect(display()).toHaveTextContent('0')
  })

  it('ignores a late response after the request was cleared', async () => {
    let resolveRequest: (value: number) => void = () => {}
    const api = {
      calculate: vi.fn(() => new Promise<number>((resolve) => (resolveRequest = resolve))),
    }
    const { user } = setup(api)

    await press(user, '1', 'Add', '1', 'Equals', 'All clear')
    await act(async () => resolveRequest(2))

    expect(display()).toHaveTextContent('0')
  })
})
