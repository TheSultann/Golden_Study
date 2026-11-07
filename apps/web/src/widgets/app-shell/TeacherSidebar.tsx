import type { ComponentProps } from 'react'
import { Sidebar } from './Sidebar'

export function TeacherSidebar(props: Omit<ComponentProps<typeof Sidebar>, 'role'> & { role?: 'teacher' }) {
  return <Sidebar {...props} role="teacher" />
}
