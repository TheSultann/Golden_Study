import {
  BarChart3, BookOpen, CalendarCheck, CalendarDays, ClipboardCheck, GraduationCap,
  LayoutDashboard, Megaphone, Send, Settings, Trophy, TrendingUp, UserRoundSearch,
  UsersRound, WalletCards,
} from 'lucide-react'

import type { UserRole } from '../../features/auth/auth.types'

export const navigationItems = [
  { label: 'Bosh sahifa', path: '/', icon: LayoutDashboard, roles: ['superadmin', 'admin', 'teacher'] },
  { label: 'O‘qituvchilar', path: '/teachers', icon: GraduationCap, roles: ['superadmin', 'admin'] },
  { label: 'Kurslar', path: '/courses', icon: BookOpen, roles: ['superadmin', 'admin'] },
  { label: 'Guruhlar', path: '/groups', icon: UsersRound, roles: ['superadmin', 'admin'] },
  { label: 'O‘quvchilar', path: '/students', icon: UsersRound, roles: ['superadmin', 'admin', 'teacher'] },
  { label: 'Davomat', path: '/attendance', icon: CalendarCheck, roles: ['superadmin', 'admin', 'teacher'] },
  { label: 'Dars jadvali', path: '/schedule', icon: CalendarDays, roles: ['superadmin', 'admin', 'teacher'] },
  { label: 'Reyting', path: '/rating', icon: Trophy, roles: ['superadmin', 'admin', 'teacher'] },
  { label: 'Lidlar', path: '/leads', icon: UserRoundSearch, roles: ['superadmin', 'admin'] },
  { label: 'Moliya', path: '/finance', icon: WalletCards, roles: ['superadmin'] },
  { label: 'Xodimlar', path: '/staff', icon: UsersRound, roles: ['superadmin'] },
  { label: 'Imtihonlar', path: '/exams', icon: ClipboardCheck, roles: ['superadmin', 'admin', 'teacher'] },
  { label: 'Maoshim', path: '/my-salary', icon: WalletCards, roles: ['teacher'] },
  { label: 'E’lonlar', path: '/announcements', icon: Megaphone, roles: ['superadmin', 'admin'] },
  { label: 'Telegram Bot', path: '/telegram-bot', icon: Send, roles: ['superadmin', 'admin'] },
  { label: 'Hisobotlar', path: '/reports', icon: BarChart3, roles: ['superadmin'] },
  { label: 'Sozlamalar', path: '/settings', icon: Settings, roles: ['superadmin', 'admin', 'teacher'] },
] as const

export function getNavigationForRole(role: UserRole) {
  return navigationItems.filter((item) => (item.roles as readonly UserRole[]).includes(role))
}

export { TrendingUp }
