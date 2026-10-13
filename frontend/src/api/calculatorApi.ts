export type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'percentage'
export type UnaryOperation = 'sqrt'
export type Operation = BinaryOperation | UnaryOperation

export type CalculationRequest =
  | { operation: BinaryOperation; a: number; b: number }
  | { operation: UnaryOperation; a: number }

/** Error codes produced by the client itself, in addition to the server's codes. */
export const CLIENT_ERROR_CODES = {
  network: 'NETWORK_ERROR',
  timeout: 'TIMEOUT',
  badResponse: 'BAD_RESPONSE',
} as const

export class ApiError extends Error {
  readonly code: string
  readonly status: number | undefined

  constructor(code: string, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/** Abstraction the UI depends on, so tests can swap in a fake. */
export interface CalculatorApi {
  calculate(request: CalculationRequest, signal?: AbortSignal): Promise<number>
}

export interface CalculatorApiOptions {
  /** Origin of the backend; empty means same origin (dev proxy or Docker image). */
  baseUrl?: string
  timeoutMs?: number
  fetchFn?: typeof fetch
}

interface SuccessBody {
  result: number
}

interface ErrorBody {
  error: { code: string; message: string }
}

const isSuccessBody = (body: unknown): body is SuccessBody =>
  typeof body === 'object' && body !== null && typeof (body as SuccessBody).result === 'number'

const isErrorBody = (body: unknown): body is ErrorBody =>
  typeof body === 'object' &&
  body !== null &&
  typeof (body as ErrorBody).error?.code === 'string' &&
  typeof (body as ErrorBody).error?.message === 'string'

export function createCalculatorApi({
  baseUrl = '',
  timeoutMs = 5000,
  fetchFn = (...args) => fetch(...args),
}: CalculatorApiOptions = {}): CalculatorApi {
  return {
    async calculate(request, signal) {
      const { operation, ...operands } = request

      // Merge the caller's signal with our own timeout so either can cancel.
      const controller = new AbortController()
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, timeoutMs)
      const forwardAbort = () => controller.abort()
      signal?.addEventListener('abort', forwardAbort, { once: true })

      let response: Response
      try {
        response = await fetchFn(`${baseUrl}/api/v1/${operation}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(operands),
          signal: controller.signal,
        })
      } catch (err) {
        if (timedOut) {
          throw new ApiError(CLIENT_ERROR_CODES.timeout, 'The calculator service took too long to respond.')
        }
        if (signal?.aborted) throw err
        throw new ApiError(CLIENT_ERROR_CODES.network, 'Unable to reach the calculator service.')
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', forwardAbort)
      }

      const body: unknown = await response.json().catch(() => null)

      if (response.ok && isSuccessBody(body)) return body.result
      if (isErrorBody(body)) throw new ApiError(body.error.code, body.error.message, response.status)
      throw new ApiError(
        CLIENT_ERROR_CODES.badResponse,
        `Unexpected response from the calculator service (HTTP ${response.status}).`,
        response.status,
      )
    },
  }
}
