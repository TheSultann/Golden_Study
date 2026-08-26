import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { getSession, restoreSession } from '../features/auth/auth.service'

export function ProtectedRoute() {
  const location = useLocation()
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'guest'>(
    () => (getSession() ? 'authenticated' : 'checking'),
  )

  useEffect(() => {
    if (status !== 'checking') return
    let active = true
    void restoreSession().then((user) => {
      if (active) setStatus(user ? 'authenticated' : 'guest')
    })
    return () => {
      active = false
    }
  }, [status])

  if (status === 'checking') {
    return <p className="route-loading">Sessiya tekshirilmoqda...</p>
  }

  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
