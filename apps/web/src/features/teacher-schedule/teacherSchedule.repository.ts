import type { TeacherScheduleLesson } from '@golden-study/contracts'

export interface TeacherScheduleRepository {
  list(): Promise<TeacherScheduleLesson[]>
}
