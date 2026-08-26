import { refreshResponseSchema } from '@golden-study/contracts'
import { z } from 'zod'

import { ApiError } from './apiError'

const apiBaseUrl =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  '/api/v1'

const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

let accessToken: string | null = null
let refreshPromise: Promise<string> | null = null

export function setAccessToken(token: string): void {
  accessToken = token
}

export function clearAccessToken(): void {
  accessToken = null
}

function createHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers)
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  return headers
}

async function parseError(response: Response): Promise<ApiError> {
  const fallback = new ApiError(
    response.status,
    'HTTP_ERROR',
    `API error: ${response.status}`,
  )
  try {
    const parsed = errorEnvelopeSchema.safeParse(await response.json())
    if (!parsed.success) return fallback
    return new ApiError(
      response.status,
      parsed.data.error.code,
      parsed.data.error.message,
      parsed.data.error.details,
    )
  } catch {
    return fallback
  }
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) throw await parseError(response)
        const result = refreshResponseSchema.parse(await response.json())
        setAccessToken(result.data.accessToken)
        return result.data.accessToken
      })
      .catch((error: unknown) => {
        clearAccessToken()
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: createHeaders(init),
  })
}

async function sendWithRefresh(
  path: string,
  init: RequestInit,
): Promise<Response> {
  let response = await send(path, init)
  if (
    response.status === 401 &&
    path !== '/auth/refresh' &&
    path !== '/auth/login'
  ) {
    await refreshAccessToken()
    response = await send(path, init)
  }
  if (!response.ok) throw await parseError(response)
  return response
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await sendWithRefresh(path, init)
  return schema.parse(await response.json())
}

export async function apiRequestVoid(
  path: string,
  init: RequestInit,
): Promise<void> {
  await sendWithRefresh(path, init)
}
