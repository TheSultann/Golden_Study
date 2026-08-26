import {
  BarChart3, BookOpen, CalendarCheck, CalendarDays, ClipboardCheck, GraduationCap,
  LayoutDashboard, Megaphone, Send, Settings, Trophy, TrendingUp, UserRoundSearch,
  UsersRound, WalletCards,
} from 'lucide-react'

import type { UserRole } from '../../features/auth/auth.types'

export const navigationItems = [
  { label: 'Bosh sahifa', path: '/', icon: LayoutDashboard, roles: ['admin', 'teacher'] },
  { label: 'O‘qituvchilar', path: '/teachers', icon: GraduationCap, roles: ['admin'] },
  { label: 'Kurslar', path: '/courses', icon: BookOpen, roles: ['admin'] },
  { label: 'Guruhlar', path: '/groups', icon: UsersRound, roles: ['admin'] },
  { label: 'O‘quvchilar', path: '/students', icon: UsersRound, roles: ['admin'] },
  { label: 'Davomat', path: '/attendance', icon: CalendarCheck, roles: ['admin', 'teacher'] },
  { label: 'Dars jadvali', path: '/schedule', icon: CalendarDays, roles: ['admin', 'teacher'] },
  { label: 'Reyting', path: '/rating', icon: Trophy, roles: ['admin', 'teacher'] },
  { label: 'Lidlar', path: '/leads', icon: UserRoundSearch, roles: ['admin'] },
  { label: 'Moliya', path: '/finance', icon: WalletCards, roles: ['admin'] },
  { label: 'Xodimlar', path: '/staff', icon: UsersRound, roles: ['admin'] },
  { label: 'Imtihonlar', path: '/exams', icon: ClipboardCheck, roles: ['admin', 'teacher'] },
  { label: 'E’lonlar', path: '/announcements', icon: Megaphone, roles: ['admin'] },
  { label: 'Telegram Bot', path: '/telegram-bot', icon: Send, roles: ['admin'] },
  { label: 'Hisobotlar', path: '/reports', icon: BarChart3, roles: ['admin'] },
  { label: 'Sozlamalar', path: '/settings', icon: Settings, roles: ['admin', 'teacher'] },
] as const

export function getNavigationForRole(role: UserRole) {
  return navigationItems.filter((item) => (item.roles as readonly UserRole[]).includes(role))
}

export { TrendingUp }
