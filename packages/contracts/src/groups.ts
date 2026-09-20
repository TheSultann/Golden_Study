import { z } from 'zod'
export const groupSchema = z.object({ id: z.string(), name: z.string().min(1), course: z.string(), teacher: z.string(), room: z.string(), weekdays: z.array(z.string()).min(1), time: z.string(), startDate: z.string(), endDate: z.string(), activeStudents: z.number().int().nonnegative(), graduateStudents: z.number().int().nonnegative(), active: z.boolean(), telegramChatId: z.string().nullable().optional(), telegramChatTitle: z.string().nullable().optional() })
export const groupListResponseSchema = z.object({ data: z.array(groupSchema) })
export const groupResponseSchema = z.object({ data: groupSchema })
export type Group = z.infer<typeof groupSchema>
