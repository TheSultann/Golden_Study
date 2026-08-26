import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { clearSession } from './features/auth/auth.service'
import { ProtectedRoute } from './routes/ProtectedRoute'

const adminApiUser = {
  id: '11111111-1111-4111-8111-111111111111',
  login: 'admin',
  role: 'ADMIN',
  teacherId: null,
}

afterEach(() => {
  clearSession()
  vi.unstubAllGlobals()
})

it('restores protected session before rendering route', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { accessToken: 'access-2', expiresInSeconds: 900 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: adminApiUser }),
      ),
  )

  renderProtected()

  expect(screen.getByText('Sessiya tekshirilmoqda...')).toBeInTheDocument()
  expect(await screen.findByText('Protected content')).toBeInTheDocument()
})

it('redirects to login when refresh fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid session' },
        },
        401,
      ),
    ),
  )

  renderProtected()

  expect(await screen.findByText('Login screen')).toBeInTheDocument()
})

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/private']}>
      <Routes>
        <Route path="/login" element={<p>Login screen</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/private" element={<p>Protected content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
