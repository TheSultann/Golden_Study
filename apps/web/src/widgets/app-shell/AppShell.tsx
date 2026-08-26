import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'

import { AppearanceProvider } from '../../features/appearance/AppearanceProvider'
import { useAppearance } from '../../features/appearance/appearanceContext'
import { getSession, logout as logoutSession } from '../../features/auth/auth.service'
import type { AuthUser } from '../../features/auth/auth.types'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const user = getSession()!
  return <AppearanceProvider userId={user.id}><AppShellContent user={user} /></AppearanceProvider>
}

function AppShellContent({ user }: { user: AuthUser }) {
  const navigate = useNavigate()
  const { palette } = useAppearance()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dark, setDark] = useState(() => window.localStorage.getItem('golden-study-theme') === 'dark')

  function toggleTheme() {
    setDark((current) => {
      const next = !current
      window.localStorage.setItem('golden-study-theme', next ? 'dark' : 'light')
      return next
    })
  }

  async function logout() {
    try {
      await logoutSession()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="app-shell" data-theme={dark ? 'dark' : 'light'} data-palette={palette}>
      <Sidebar role={user.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={() => void logout()} />
      <div className="app-column">
        <Topbar user={user} dark={dark} onMenu={() => setSidebarOpen(true)} onTheme={toggleTheme} onLogout={() => void logout()} />
        <main className="app-content"><Outlet /></main>
      </div>
    </div>
  )
}
