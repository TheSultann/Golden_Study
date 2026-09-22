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

export type AttendanceSession = z.infer<typeof attendanceSessionSchema>;
export type AttendanceRow = z.infer<typeof attendanceRowSchema>;
export type AttendanceBroadcastInput = z.infer<typeof attendanceBroadcastInputSchema>;
export type AttendanceBroadcastResult = z.infer<typeof attendanceBroadcastResultSchema>;
