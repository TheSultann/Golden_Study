import { z } from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './apiError'
import {
  apiRequest,
  clearAccessToken,
  setAccessToken,
} from './httpClient'

const successSchema = z.object({
  success: z.literal(true),
  data: z.object({ value: z.string() }),
})

afterEach(() => {
  clearAccessToken()
  vi.unstubAllGlobals()
})

describe('apiRequest', () => {
  it('sends bearer token and cookies and validates JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: { value: 'ok' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken('access-1')

    await expect(apiRequest('/courses', {}, successSchema)).resolves.toEqual({
      success: true,
      data: { value: 'ok' },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/courses',
      expect.objectContaining({ credentials: 'include' }),
    )
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(new Headers(requestInit.headers).get('Authorization')).toBe(
      'Bearer access-1',
    )
  })

  it('shares one refresh request across concurrent 401 responses', async () => {
    let protectedCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/refresh')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { accessToken: 'access-2', expiresInSeconds: 900 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      protectedCalls += 1
      if (protectedCalls <= 2) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify({ success: true, data: { value: 'ok' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken('expired')

    await expect(
      Promise.all([
        apiRequest('/courses', {}, successSchema),
        apiRequest('/rooms', {}, successSchema),
      ]),
    ).resolves.toHaveLength(2)

    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith('/auth/refresh'),
      ),
    ).toHaveLength(1)
  })

  it('throws typed backend error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'CONFLICT',
              message: 'Course title already exists',
              details: { field: 'title' },
            },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    const error = await apiRequest('/courses', {}, successSchema).catch(
      (value: unknown) => value,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Course title already exists',
      details: { field: 'title' },
    })
  })
})
