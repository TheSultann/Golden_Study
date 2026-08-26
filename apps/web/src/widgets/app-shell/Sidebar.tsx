import { X, LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import goldenStudyEmblem from '../../assets/golden-study-emblem.png'
import type { UserRole } from '../../features/auth/auth.types'
import { getNavigationForRole } from './navigation'

interface SidebarProps {
  role: UserRole
  open: boolean
  onClose: () => void
  onLogout: () => void
}

export function Sidebar({ role, open, onClose, onLogout }: SidebarProps) {
  return (
    <>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <img className="sidebar-logo-image" src={goldenStudyEmblem} alt="" />
          <span>Golden Study CRM</span>
          <button className="sidebar-close" type="button" onClick={onClose} aria-label="Menyuni yopish"><X size={19} /></button>
        </div>

        <nav className="sidebar-nav" aria-label="Asosiy navigatsiya">
          {getNavigationForRole(role).map(({ label, path, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === '/'} onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <footer className="sidebar-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <strong style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Golden Study markazi</strong>
          <button
            type="button"
            onClick={onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              color: 'var(--muted)',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#b91c1c'
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted)'
              e.currentTarget.style.background = 'transparent'
            }}
            title="Chiqish"
            aria-label="Tizimdan chiqish"
          >
            <LogOut size={16} />
          </button>
        </footer>
      </aside>
      {open ? <button className="sidebar-backdrop" type="button" onClick={onClose} aria-label="Menyuni yopish" /> : null}
    </>
  )
}
