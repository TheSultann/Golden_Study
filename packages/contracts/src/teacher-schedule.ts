import { z } from 'zod'

export const teacherScheduleLessonSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  groupName: z.string(),
  courseName: z.string(),
  weekday: z.enum(['Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha', 'Yak']),
  time: z.string(),
  room: z.string(),
  studentsCount: z.number().int().nonnegative(),
})

export const teacherScheduleResponseSchema = z.object({ data: z.array(teacherScheduleLessonSchema) })
export type TeacherScheduleLesson = z.infer<typeof teacherScheduleLessonSchema>
