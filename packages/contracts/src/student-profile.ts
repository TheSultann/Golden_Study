import { z } from 'zod'
import { studentSchema } from './students.js'
import { studentApiSchema } from './core-api.js'

export const studentAcademicSummarySchema = z.object({
  ratingScore: z.number().int().min(0).max(100).nullable(),
  groupPlace: z.number().int().positive().nullable(),
  examAveragePercent: z.number().int().min(0).max(100).nullable(),
  attendancePercent: z.number().int().min(0).max(100).nullable(),
  homeworkPercent: z.number().int().min(0).max(100).nullable(),
})

export const studentProfileSchema = z.object({
  student: studentSchema,
  academicSummary: studentAcademicSummarySchema,
  updatedAt: z.string(),
})

export const studentProfileResponseSchema = z.object({ data: studentProfileSchema })

export const studentProfileApiSchema = z.object({
  student: studentApiSchema.extend({
    balanceUzs: z.number().int().default(0),
  }),
  academicSummary: studentAcademicSummarySchema,
  updatedAt: z.string(),
})

export const studentProfileApiResponseSchema = z.object({
  success: z.literal(true),
  data: studentProfileApiSchema,
})

export type StudentAcademicSummary = z.infer<typeof studentAcademicSummarySchema>
export type StudentProfile = z.infer<typeof studentProfileSchema>
export type StudentProfileApi = z.infer<typeof studentProfileApiSchema>
