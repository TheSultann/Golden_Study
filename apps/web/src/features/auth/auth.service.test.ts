import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearSession,
  getSession,
  login,
  logout,
  restoreSession,
} from './auth.service'

const adminApiUser = {
  id: '11111111-1111-4111-8111-111111111111',
  login: 'admin',
  role: 'ADMIN',
  teacherId: null,
}

afterEach(() => {
  clearSession()
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('auth service', () => {
  it('logs in through API and keeps session outside localStorage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              user: adminApiUser,
              accessToken: 'access-1',
              expiresInSeconds: 900,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(
      login({ login: 'admin', password: 'admin123' }),
    ).resolves.toEqual({
      id: adminApiUser.id,
      login: 'admin',
      name: 'Administrator',
      role: 'admin',
    })
    expect(getSession()?.role).toBe('admin')
    expect(window.localStorage.getItem('golden-study-session')).toBeNull()
  })

  it('restores user after refresh', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { accessToken: 'access-2', expiresInSeconds: 900 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, data: adminApiUser }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(restoreSession()).resolves.toMatchObject({
      login: 'admin',
      role: 'admin',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares one restore flow across concurrent callers', async () => {
    let refreshCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1
        await Promise.resolve()
        return new Response(
          JSON.stringify({
            success: true,
            data: { accessToken: 'access-2', expiresInSeconds: 900 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify({ success: true, data: adminApiUser }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const [first, second] = await Promise.all([
      restoreSession(),
      restoreSession(),
    ])

    expect(first).toEqual(second)
    expect(refreshCalls).toBe(1)
  })

  it('clears runtime session even when logout request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await loginSessionForTest()

    await expect(logout()).rejects.toThrow('offline')
    expect(getSession()).toBeNull()
  })
})

async function loginSessionForTest(): Promise<void> {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        data: {
          user: adminApiUser,
          accessToken: 'access-1',
          expiresInSeconds: 900,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  await login({ login: 'admin', password: 'admin123' })
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
}
