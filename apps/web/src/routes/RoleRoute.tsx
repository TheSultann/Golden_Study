import { Navigate, Outlet } from 'react-router-dom'
import type { UserRole } from '../features/auth/auth.types'
import { getSession } from '../features/auth/auth.service'

export function RoleRoute({ allowed }: { allowed: readonly UserRole[] }) {
  const user = getSession()
  return user && allowed.includes(user.role) ? <Outlet /> : <Navigate to="/" replace />
}
