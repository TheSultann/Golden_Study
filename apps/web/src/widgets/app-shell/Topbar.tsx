import { CalendarDays, LogOut, Menu, Moon, Sun, UserRound } from 'lucide-react'

import type { AuthUser } from '../../features/auth/auth.types'

interface TopbarProps {
  user: AuthUser
  dark: boolean
  onMenu: () => void
  onTheme: () => void
  onLogout: () => void
}

function getUzbekDate() {
  const date = new Date()
  const days = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
  const months = [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
  ]
  const dayName = days[date.getDay()]
  const monthName = months[date.getMonth()]
  const day = date.getDate()
  const year = date.getFullYear()
  return `${day} ${monthName} ${year}, ${dayName}`
}

export function Topbar({ user, dark, onMenu, onTheme, onLogout }: TopbarProps) {
  return (
    <header className="topbar">
      <button className="icon-button menu-button" type="button" onClick={onMenu} aria-label="Menyuni ochish"><Menu size={19} /></button>
      <div className="topbar-actions">
        <span className="topbar-date"><CalendarDays size={16} /> {getUzbekDate()}</span>
        <button className="topbar-control" type="button" onClick={onTheme} aria-label={dark ? 'Yorug‘ rejim' : 'Tungi rejim'} title={dark ? 'Yorug‘ rejim' : 'Tungi rejim'}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <span className="topbar-user"><UserRound size={16} /><span>{user.name}</span></span>
        <button className="topbar-control" type="button" onClick={onLogout}><LogOut size={16} /><span>Chiqish</span></button>
      </div>
    </header>
  )
}
