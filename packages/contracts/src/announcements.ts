import { z } from 'zod'

export const announcementTargetTypeSchema = z.enum(['all', 'group', 'course'])
export const announcementDeliveryStatusSchema = z.enum(['draft', 'scheduled', 'queued', 'BOT_DELIVERED', 'failed'])

export const announcementSchema = z.object({
  id: z.string(),
  targetType: announcementTargetTypeSchema,
  targetId: z.string().nullable(),
  targetName: z.string(),
  title: z.string().min(1),
  body: z.string().min(1),
  deliveryStatus: announcementDeliveryStatusSchema,
  createdAt: z.string(),
  scheduledAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
})

export const announcementListResponseSchema = z.object({ data: z.array(announcementSchema) })
export const announcementResponseSchema = z.object({ data: announcementSchema })

export const announcementSendInputSchema = z.object({
  targetType: announcementTargetTypeSchema,
  targetId: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
})

export type Announcement = z.infer<typeof announcementSchema>
export type AnnouncementTargetType = z.infer<typeof announcementTargetTypeSchema>
export type AnnouncementSendInput = z.infer<typeof announcementSendInputSchema>
