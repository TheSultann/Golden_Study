import { z } from 'zod';

export const attendanceStatusSchema = z.enum(['came', 'excused', 'absent', 'unmarked']);

export const attendanceRowSchema = z.object({
  studentId: z.string(),
  studentCode: z.string(),
  studentName: z.string(),
  status: attendanceStatusSchema,
  rating: z.number().int().min(0).max(100).nullable().optional(),
  homeworkDone: z.boolean(),
  homeworkScore: z.number().int().min(0).max(100).nullable().optional(),
  topicScore: z.number().int().min(0).max(100).nullable().optional(),
  dictionaryScore: z.number().int().min(0).max(100).nullable().optional(),
  comment: z.string(),
  lockedByAdmin: z.boolean(),
});

export const attendanceSessionSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  date: z.string(),
  topic: z.string().optional(),
  lessonTitle: z.string().optional(),
  homeworkText: z.string().default(''),
  rows: z.array(attendanceRowSchema),
});

export const attendanceResponseSchema = z.object({
  data: attendanceSessionSchema,
});

export const attendanceBroadcastInputSchema = z.object({
  groupId: z.string().optional(),
  date: z.string(),
  topic: z.string().optional().default(''),
  homeworkText: z.string().optional().default(''),
  sendToGroupChat: z.boolean().default(true),
  sendToStudents: z.boolean().default(true),
});

export const attendanceBroadcastResultSchema = z.object({
  success: z.boolean(),
  groupChatSent: z.boolean(),
  groupChatTitle: z.string().nullable().optional(),
  studentsSentCount: z.number().int().nonnegative(),
  totalActiveStudents: z.number().int().nonnegative(),
  telegramLinkedStudents: z.number().int().nonnegative(),
  nextLessonDate: z.string().nullable().optional(),
  nextLessonTime: z.string().nullable().optional(),
  nextLessonRoom: z.string().nullable().optional(),
  nextLessonSummary: z.string().nullable().optional(),
  message: z.string(),
});

export const attendanceBroadcastResponseSchema = z.object({
  data: attendanceBroadcastResultSchema,
});

export const monthlyAttendanceStudentDaySchema = z.object({
  status: attendanceStatusSchema,
  rating: z.number().int().min(0).max(100).nullable().optional(),
  homeworkDone: z.boolean().optional(),
  homeworkScore: z.number().int().min(0).max(100).nullable().optional(),
  topicScore: z.number().int().min(0).max(100).nullable().optional(),
  dictionaryScore: z.number().int().min(0).max(100).nullable().optional(),
  comment: z.string().optional(),
});

export const monthlyAttendanceStudentRowSchema = z.object({
  studentId: z.string(),
  studentCode: z.string(),
  studentName: z.string(),
  phone: z.string().nullable().optional(),
  days: z.record(z.string(), monthlyAttendanceStudentDaySchema),
  stats: z.object({
    totalLessons: z.number().int().nonnegative(),
    came: z.number().int().nonnegative(),
    excused: z.number().int().nonnegative(),
    absent: z.number().int().nonnegative(),
    unmarked: z.number().int().nonnegative(),
    percentage: z.number().int().min(0).max(100),
    averageScore: z.number().nullable().optional(),
  }),
});

export const monthlyLessonDaySchema = z.object({
  date: z.string(),
  dayNumber: z.number().int().min(1).max(31),
  weekday: z.string(),
  hasLesson: z.boolean(),
  lessonTitle: z.string().nullable().optional(),
});

export const monthlyAttendanceDataSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  month: z.string(),
  daysInMonth: z.number().int().min(28).max(31),
  lessonDates: z.array(z.string()),
  days: z.array(monthlyLessonDaySchema),
  students: z.array(monthlyAttendanceStudentRowSchema),
  stats: z.object({
    totalStudents: z.number().int().nonnegative(),
    totalLessons: z.number().int().nonnegative(),
    averageAttendancePercentage: z.number().int().min(0).max(100),
  }),
});

export const monthlyAttendanceResponseSchema = z.object({
  data: monthlyAttendanceDataSchema,
});

export type AttendanceSession = z.infer<typeof attendanceSessionSchema>;
export type AttendanceRow = z.infer<typeof attendanceRowSchema>;
export type AttendanceBroadcastInput = z.infer<typeof attendanceBroadcastInputSchema>;
export type AttendanceBroadcastResult = z.infer<typeof attendanceBroadcastResultSchema>;
export type MonthlyAttendanceStudentDay = z.infer<typeof monthlyAttendanceStudentDaySchema>;
export type MonthlyAttendanceStudentRow = z.infer<typeof monthlyAttendanceStudentRowSchema>;
export type MonthlyLessonDay = z.infer<typeof monthlyLessonDaySchema>;
export type MonthlyAttendanceData = z.infer<typeof monthlyAttendanceDataSchema>;
export type MonthlyAttendanceResponse = z.infer<typeof monthlyAttendanceResponseSchema>;
