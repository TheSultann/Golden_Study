import type { Teacher } from './teacher.types'

export interface TeacherRepository {
  list(): Promise<Teacher[]>
  create(teacher: Teacher): Promise<Teacher>
  update(teacher: Teacher): Promise<Teacher>
  setActive(id: string, active: boolean): Promise<Teacher>
}
