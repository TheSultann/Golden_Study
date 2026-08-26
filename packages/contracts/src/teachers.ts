import { z } from 'zod'

export const salaryTypeSchema = z.enum(['fixed', 'per_student', 'percent'])

export const teacherSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().regex(/^\+998\s\d{2}\s\d{3}\s\d{2}\s\d{2}$/),
  salaryType: salaryTypeSchema,
  rate: z.number().nonnegative(),
  kpiBalance: z.number().int(),
  groups: z.array(z.string()),
  login: z.string().min(1),
  active: z.boolean(),
})

export const teacherListResponseSchema = z.object({ data: z.array(teacherSchema) })
export const teacherResponseSchema = z.object({ data: teacherSchema })

export type SalaryType = z.infer<typeof salaryTypeSchema>
export type Teacher = z.infer<typeof teacherSchema>
