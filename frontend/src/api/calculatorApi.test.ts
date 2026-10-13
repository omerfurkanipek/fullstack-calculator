import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createCalculatorApi } from './calculatorApi'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('createCalculatorApi', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('posts operands to the operation endpoint and returns the result', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { operation: 'add', operands: [2, 3], result: 5 }))
    const api = createCalculatorApi({ baseUrl: 'http://api.test', fetchFn })

    await expect(api.calculate({ operation: 'add', a: 2, b: 3 })).resolves.toBe(5)

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('http://api.test/api/v1/add')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ a: 2, b: 3 })
  })

  it('sends a single operand for unary operations', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { result: 3 }))
    await createCalculatorApi({ fetchFn }).calculate({ operation: 'sqrt', a: 9 })

    expect(fetchFn.mock.calls[0][0]).toBe('/api/v1/sqrt')
    expect(JSON.parse(fetchFn.mock.calls[0][1]?.body as string)).toEqual({ a: 9 })
  })

  it('surfaces the server error code and message', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(422, { error: { code: 'DIVISION_BY_ZERO', message: 'Division by zero is not allowed.' } }))

    const error = await createCalculatorApi({ fetchFn })
      .calculate({ operation: 'divide', a: 1, b: 0 })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'DIVISION_BY_ZERO', status: 422, message: 'Division by zero is not allowed.' })
  })

  it('reports unexpected payloads as BAD_RESPONSE', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>502</html>', { status: 502 }))

    await expect(createCalculatorApi({ fetchFn }).calculate({ operation: 'add', a: 1, b: 1 })).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
      status: 502,
    })
  })

  it('reports a 200 without a numeric result as BAD_RESPONSE', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { result: 'NaN' }))

    await expect(createCalculatorApi({ fetchFn }).calculate({ operation: 'add', a: 1, b: 1 })).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    })
  })

  it('maps fetch failures to NETWORK_ERROR', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(createCalculatorApi({ fetchFn }).calculate({ operation: 'add', a: 1, b: 1 })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
  })

  it('times out slow requests', async () => {
    vi.useFakeTimers()
    const fetchFn = vi.fn<typeof fetch>((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })

    const promise = createCalculatorApi({ fetchFn, timeoutMs: 1000 }).calculate({ operation: 'add', a: 1, b: 1 })
    const assertion = expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })

  it('propagates caller cancellation untouched', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    const fetchFn = vi.fn<typeof fetch>((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(abortError))
      })
    })
    const controller = new AbortController()

    const promise = createCalculatorApi({ fetchFn }).calculate({ operation: 'add', a: 1, b: 1 }, controller.signal)
    controller.abort()

    await expect(promise).rejects.toBe(abortError)
  })
})
