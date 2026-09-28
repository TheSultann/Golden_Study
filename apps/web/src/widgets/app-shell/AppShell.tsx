import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'

import { AppearanceProvider } from '../../features/appearance/AppearanceProvider'
import { useAppearance } from '../../features/appearance/appearanceContext'
import { getSession, logout as logoutSession } from '../../features/auth/auth.service'
import type { AuthUser } from '../../features/auth/auth.types'
import { UnsavedChangesProvider, useUnsavedChanges } from '../../shared/context/UnsavedChangesContext'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const user = getSession()!
  return (
    <AppearanceProvider userId={user.id}>
      <AppShellContent user={user} />
    </AppearanceProvider>
  )
}

function AppShellContent({ user }: { user: AuthUser }) {
  const { palette } = useAppearance()
  const [dark, setDark] = useState(() => window.localStorage.getItem('golden-study-theme') === 'dark')

  function toggleTheme() {
    setDark((current) => {
      const next = !current
      window.localStorage.setItem('golden-study-theme', next ? 'dark' : 'light')
      return next
    })
  }

  return (
    <div className="app-shell" data-theme={dark ? 'dark' : 'light'} data-palette={palette}>
      <UnsavedChangesProvider>
        <AppShellInner user={user} dark={dark} onTheme={toggleTheme} />
      </UnsavedChangesProvider>
    </div>
  )
}

function AppShellInner({
  user,
  dark,
  onTheme,
}: {
  user: AuthUser
  dark: boolean
  onTheme: () => void
}) {
  const navigate = useNavigate()
  const { isDirty, requestNavigate } = useUnsavedChanges()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function performLogout() {
    try {
      await logoutSession()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  function handleLogout() {
    if (isDirty) {
      requestNavigate(() => void performLogout())
    } else {
      void performLogout()
    }
  }

  return (
    <>
      <Sidebar role={user.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} />
      <div className="app-column">
        <Topbar user={user} dark={dark} onMenu={() => setSidebarOpen(true)} onTheme={onTheme} onLogout={handleLogout} />
        <main className="app-content"><Outlet /></main>
      </div>
    </>
  )
}
