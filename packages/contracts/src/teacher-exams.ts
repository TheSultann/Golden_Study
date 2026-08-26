import { z } from 'zod'
export const teacherExamStudentSchema = z.object({ id: z.string(), code: z.string(), name: z.string() })
export const teacherExamGroupSchema = z.object({ id: z.string(), name: z.string(), students: z.array(teacherExamStudentSchema) })
export const teacherExamGroupsResponseSchema = z.object({ data: z.array(teacherExamGroupSchema) })
export type TeacherExamGroup = z.infer<typeof teacherExamGroupSchema>
