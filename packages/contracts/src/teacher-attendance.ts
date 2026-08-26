import { z } from 'zod'
export const teacherAttendanceGroupSchema = z.object({ id: z.string(), name: z.string() })
export const teacherAttendanceGroupsResponseSchema = z.object({ data: z.array(teacherAttendanceGroupSchema) })
export type TeacherAttendanceGroup = z.infer<typeof teacherAttendanceGroupSchema>
