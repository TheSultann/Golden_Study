import { z } from 'zod'
export const teacherAttendanceGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  telegramChatId: z.string().nullable().optional(),
  telegramChatTitle: z.string().nullable().optional(),
})
export const teacherAttendanceGroupsResponseSchema = z.object({ data: z.array(teacherAttendanceGroupSchema) })
export type TeacherAttendanceGroup = z.infer<typeof teacherAttendanceGroupSchema>
