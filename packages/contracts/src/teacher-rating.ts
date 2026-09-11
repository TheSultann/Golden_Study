import { z } from 'zod'
export const teacherRatingRowSchema = z.object({ studentId: z.string(), studentCode: z.string(), studentName: z.string(), groupName: z.string(), examsCount: z.number().int().nonnegative(), averagePercent: z.number().int().min(0).max(100), attendanceRate: z.number().int().min(0).max(100), attendanceRating: z.number().min(0).max(100), homeworkRate: z.number().int().min(0).max(100), totalScore: z.number().int().min(0).max(100), stars: z.number().int().min(0).max(5) })
export const teacherRatingResponseSchema = z.object({ data: z.array(teacherRatingRowSchema) })
export type TeacherRatingRow = z.infer<typeof teacherRatingRowSchema>

