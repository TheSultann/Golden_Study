import { z } from 'zod'

export const telegramLinkStatusSchema = z.enum(['pending', 'active', 'rejected'])
export const telegramTriggerTypeSchema = z.enum(['attendance_absent', 'homework_missing', 'exam_result', 'payment_received', 'debt_reminder', 'announcement', 'lesson_broadcast'])

export const telegramLinkSchema = z.object({
  id: z.string(),
  telegramChatId: z.string(),
  studentId: z.string(),
  studentCode: z.string(),
  studentName: z.string(),
  parentName: z.string(),
  parentPhone: z.string(),
  status: telegramLinkStatusSchema,
  requestedAt: z.string(),
})

export const telegramNotificationLogSchema = z.object({
  id: z.string(),
  telegramLinkId: z.string(),
  triggerType: telegramTriggerTypeSchema,
  status: z.enum(['queued', 'sent', 'failed']),
  payload: z.string(),
  queuedAt: z.string(),
  sentAt: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  errorMessage: z.string().nullable(),
  jobId: z.string(),
})

export const telegramBotOverviewSchema = z.object({
  links: z.array(telegramLinkSchema),
  notifications: z.array(telegramNotificationLogSchema),
  queue: z.object({
    waiting: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    sentToday: z.number().int().nonnegative(),
  }),
  service: z.object({
    mode: z.enum(['webhook', 'polling']),
    status: z.enum(['online', 'offline']),
    lastHeartbeatAt: z.string(),
  }),
})

export const telegramBotOverviewResponseSchema = z.object({ data: telegramBotOverviewSchema })
export const telegramLinkResponseSchema = z.object({ data: telegramLinkSchema })
export const telegramNotificationLogResponseSchema = z.object({ data: telegramNotificationLogSchema })

export const telegramLinkStatusUpdateInputSchema = z.object({
  status: telegramLinkStatusSchema,
})

export const telegramNotificationEnqueueInputSchema = z.object({
  linkId: z.string().uuid(),
  triggerType: telegramTriggerTypeSchema,
})

export type TelegramLinkStatus = z.infer<typeof telegramLinkStatusSchema>
export type TelegramTriggerType = z.infer<typeof telegramTriggerTypeSchema>
export type TelegramLink = z.infer<typeof telegramLinkSchema>
export type TelegramNotificationLog = z.infer<typeof telegramNotificationLogSchema>
export type TelegramBotOverview = z.infer<typeof telegramBotOverviewSchema>
