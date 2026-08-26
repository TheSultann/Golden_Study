import { z } from 'zod'

export const courseSchema = z.object({ id: z.string(), title: z.string().min(1), description: z.string(), durationMonths: z.number().int().positive(), pricePerMonth: z.number().int().nonnegative(), groupsCount: z.number().int().nonnegative(), studentsCount: z.number().int().nonnegative(), active: z.boolean() })
export const courseListResponseSchema = z.object({ data: z.array(courseSchema) })
export const courseResponseSchema = z.object({ data: courseSchema })
export type Course = z.infer<typeof courseSchema>
