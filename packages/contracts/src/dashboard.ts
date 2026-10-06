import { z } from 'zod'

export const dashboardStatSchema = z.object({
  label: z.string(),
  value: z.string(),
  change: z.string(),
  tone: z.enum(['green', 'blue', 'gold', 'violet']),
})

export const upcomingLessonSchema = z.object({
  time: z.string(),
  title: z.string(),
  meta: z.string(),
  room: z.string(),
  date: z.string().optional(),
})

export const recentPaymentSchema = z.object({
  date: z.string(),
  student: z.string(),
  course: z.string(),
  amount: z.string(),
  status: z.string(),
  tone: z.enum(['success', 'warning', 'danger']),
})

export const attendanceTrendPointSchema = z.object({
  date: z.string(),
  label: z.string(),
  rate: z.number().int().min(0).max(100),
  total: z.number().int().nonnegative(),
  came: z.number().int().nonnegative(),
})

export const dashboardSchema = z.object({
  stats: z.array(dashboardStatSchema),
  upcomingLessons: z.array(upcomingLessonSchema),
  recentPayments: z.array(recentPaymentSchema),
  attendanceTrend: z.array(attendanceTrendPointSchema).optional().default([]),
})

export const dashboardResponseSchema = z.object({ data: dashboardSchema })

export type DashboardStat = z.infer<typeof dashboardStatSchema>
export type UpcomingLesson = z.infer<typeof upcomingLessonSchema>
export type RecentPayment = z.infer<typeof recentPaymentSchema>
export type AttendanceTrendPoint = z.infer<typeof attendanceTrendPointSchema>
export type DashboardData = z.infer<typeof dashboardSchema>
