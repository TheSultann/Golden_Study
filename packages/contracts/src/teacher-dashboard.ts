import { z } from 'zod'

export const teacherDashboardLessonSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  groupName: z.string(),
  courseName: z.string(),
  time: z.string(),
  room: z.string(),
})

export const teacherDashboardSchema = z.object({
  teacherName: z.string(),
  activeGroups: z.number().int().nonnegative(),
  activeStudents: z.number().int().nonnegative(),
  todayLessons: z.number().int().nonnegative(),
  attendancePercent: z.number().int().min(0).max(100),
  upcomingLessons: z.array(teacherDashboardLessonSchema),
})

export const teacherDashboardResponseSchema = z.object({ data: teacherDashboardSchema })

export type TeacherDashboard = z.infer<typeof teacherDashboardSchema>
