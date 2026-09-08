import { z } from 'zod'

export const teacherSalaryHistoryItemSchema = z.object({
  id: z.string(),
  date: z.string(),
  amountUzs: z.number().int(),
  type: z.enum(['payout', 'accrual']),
  status: z.enum(['paid', 'pending']),
  title: z.string(),
  comment: z.string().optional(),
})

export const teacherSalaryOverviewSchema = z.object({
  teacherName: z.string(),
  pendingBalanceUzs: z.number().int(),
  totalPaidUzs: z.number().int(),
  salaryType: z.enum(['fixed', 'per_student', 'percent']),
  salaryRate: z.number(),
  lastPaidAt: z.string().nullable(),
  history: z.array(teacherSalaryHistoryItemSchema),
})

export const teacherSalaryOverviewResponseSchema = z.object({
  data: teacherSalaryOverviewSchema,
})

export type TeacherSalaryHistoryItem = z.infer<typeof teacherSalaryHistoryItemSchema>
export type TeacherSalaryOverview = z.infer<typeof teacherSalaryOverviewSchema>
export type TeacherSalaryOverviewResponse = z.infer<typeof teacherSalaryOverviewResponseSchema>
