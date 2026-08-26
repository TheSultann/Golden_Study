import { z } from 'zod'
import { studentSchema } from './students.js'

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

export type StudentAcademicSummary = z.infer<typeof studentAcademicSummarySchema>
export type StudentProfile = z.infer<typeof studentProfileSchema>
