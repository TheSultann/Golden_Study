import { z } from 'zod'

export const financeTransactionTypeSchema = z.enum(['income', 'expense'])
export const financeTransactionSchema = z.object({
  id: z.string(),
  type: financeTransactionTypeSchema,
  category: z.string(),
  amount: z.number().int(),
  subject: z.string(),
  comment: z.string(),
  studentId: z.string().optional(),
  createdAt: z.string(),
})
export const financePaymentSchema = z.object({ id: z.string(), studentCode: z.string(), studentName: z.string(), group: z.string(), amount: z.number().int(), method: z.string(), paidAt: z.string() })
export const financeDebtSchema = z.object({ id: z.string(), studentCode: z.string(), studentName: z.string(), group: z.string(), parentPhone: z.string(), balance: z.number().int() })
export const financeTeacherSalarySchema = z.object({
  id: z.string(),
  teacherName: z.string(),
  salaryType: z.enum(['fixed', 'per_student', 'percent']),
  rate: z.number().int(),
  kpiBalance: z.number().int(),
  groups: z.array(z.string()),
  role: z.string().optional(),
  recipientType: z.enum(['STAFF', 'TEACHER']).optional(),
  lastSalaryPaidAt: z.string().nullable().optional(),
  isPaidThisMonth: z.boolean().optional(),
})
export const financeSummarySchema = z.object({ income: z.number().int(), expense: z.number().int(), profit: z.number().int(), debt: z.number().int(), salaryDebt: z.number().int() })
export const financeOverviewSchema = z.object({ summary: financeSummarySchema, payments: z.array(financePaymentSchema), debts: z.array(financeDebtSchema), salaries: z.array(financeTeacherSalarySchema), transactions: z.array(financeTransactionSchema) })
export const financeOverviewResponseSchema = z.object({ data: financeOverviewSchema })
export const financeTransactionResponseSchema = z.object({ data: financeTransactionSchema })
export const financeTeacherSalaryResponseSchema = z.object({ data: financeTeacherSalarySchema })

export type FinanceTransactionType = z.infer<typeof financeTransactionTypeSchema>
export type FinanceTransaction = z.infer<typeof financeTransactionSchema>
export type FinancePayment = z.infer<typeof financePaymentSchema>
export type FinanceDebt = z.infer<typeof financeDebtSchema>
export type FinanceTeacherSalary = z.infer<typeof financeTeacherSalarySchema>
export type FinanceSummary = z.infer<typeof financeSummarySchema>
export type FinanceOverview = z.infer<typeof financeOverviewSchema>
