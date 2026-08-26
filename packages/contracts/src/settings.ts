import { z } from 'zod'

export const centerSettingsSchema = z.object({
  id: z.string(),
  centerName: z.string().min(1),
  logoUrl: z.string().url().nullable(),
  timezone: z.literal('Asia/Tashkent'),
  currency: z.literal('UZS'),
  dateFormat: z.literal('DD.MM.YYYY'),
  updatedAt: z.string(),
})

export const centerSettingsResponseSchema = z.object({ data: centerSettingsSchema })

export type CenterSettings = z.infer<typeof centerSettingsSchema>
