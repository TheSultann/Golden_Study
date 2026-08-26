import { z } from 'zod'

export const dashboardStatSchema = z.object({ label: z.string(), value: z.string(), change: z.string(), tone: z.enum(['green', 'blue', 'gold', 'violet']) })
export const upcomingLessonSchema = z.object({ time: z.string(), title: z.string(), meta: z.string(), room: z.string() })
export const recentPaymentSchema = z.object({ date: z.string(), student: z.string(), course: z.string(), amount: z.string(), status: z.string(), tone: z.enum(['success', 'warning', 'danger']) })
export const dashboardSchema = z.object({ stats: z.array(dashboardStatSchema), upcomingLessons: z.array(upcomingLessonSchema), recentPayments: z.array(recentPaymentSchema) })
export const dashboardResponseSchema = z.object({ data: dashboardSchema })

export type DashboardData = z.infer<typeof dashboardSchema>
