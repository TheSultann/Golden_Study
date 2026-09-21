import {
  paginationMetaSchema,
  teacherApiSchema,
  type FinanceOverview,
  type FinanceTransaction,
  type StaffMember,
} from '@golden-study/contracts'
import { z } from 'zod'

import { apiRequest } from '../../shared/api/httpClient'
import type {
  FinanceRepository,
  SaveExpenseInput,
  SaveFinanceTransactionInput,
  SaveStudentPaymentInput,
} from './finance.repository'

const summarySchema = z.object({
  incomeUzs: z.number().default(0),
  expenseUzs: z.number().default(0),
  netCashflowUzs: z.number().default(0),
  studentDebtUzs: z.number().default(0),
  teacherPayableUzs: z.number().default(0),
})

const summaryResponseSchema = z.object({
  success: z.literal(true),
  data: summarySchema,
})

const transactionApiSchema = z.object({
  id: z.string(),
  direction: z.enum(['CREDIT', 'DEBIT']),
  category: z.string().optional().default('OTHER'),
  amountUzs: z.number(),
  categoryLabel: z.string().optional().default(''),
  subject: z.string().optional().default(''),
  comment: z.string().optional().default(''),
  studentId: z.string().nullable().optional(),
  createdAt: z.string(),
})

const transactionListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(transactionApiSchema),
})

const singleTransactionResponseSchema = z.object({
  success: z.literal(true),
  data: transactionApiSchema,
})

const teacherListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(teacherApiSchema),
  meta: paginationMetaSchema.optional(),
})

function mapPaymentMethod(method: string): 'CASH' | 'CLICK' | 'PAYME' | 'UZUM' | 'TERMINAL' | 'BANK' {
  const m = method.toUpperCase()
  if (['CASH', 'CLICK', 'PAYME', 'UZUM', 'TERMINAL', 'BANK'].includes(m)) {
    return m as 'CASH' | 'CLICK' | 'PAYME' | 'UZUM' | 'TERMINAL' | 'BANK'
  }
  return 'CASH'
}

const paymentApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string().optional().default(() => `pay-${Date.now()}`),
    studentId: z.string().optional().default(''),
    groupId: z.string().nullable().optional(),
    amountUzs: z.number().optional().default(0),
    method: z.string().optional().default('CASH'),
    comment: z.string().optional().default(''),
    createdAt: z.string().optional().default(() => new Date().toISOString()),
  }),
})

function toUiTransaction(api: z.infer<typeof transactionApiSchema>): FinanceTransaction {
  const isIncome = api.direction === 'CREDIT'
  let category = api.categoryLabel || api.category || (isIncome ? 'To‘lov' : 'Chiqim')
  let subject = api.subject

  if (category === 'STUDENT_PAYMENT') {
    category = 'O‘quvchi to‘lovi'
  } else if (category === 'STAFF_PAYOUT' || category === 'TEACHER_PAYOUT') {
    category = 'Xodimlar ish haqi'
    if (!subject || subject === 'Xarajat' || subject === 'STAFF_PAYOUT' || subject === 'TEACHER_PAYOUT') {
      const loginMatch = api.comment?.match(/\(([^)]+)\)$/)
      subject = loginMatch ? `@${loginMatch[1]}` : 'Xodim / O‘qituvchi'
    } else {
      subject = subject.replace(/^Xodimlar ish haqi:\s*/i, '')
    }
  } else if (category === 'DAILY_LESSON_CHARGE') {
    category = 'Dars billingi'
    if (!subject || subject === 'Xarajat') {
      subject = 'Abonement yechildi'
    }
  } else if (category === 'MANUAL_EXPENSE') {
    category = 'Boshqa xarajat'
  } else if (category === 'MANUAL_INCOME') {
    category = 'Kirim'
  }

  return {
    id: api.id,
    type: isIncome ? 'income' : 'expense',
    category,
    amount: api.amountUzs,
    subject: subject || (isIncome ? 'O‘quvchi to‘lovi' : 'Xarajat'),
    comment: api.comment || '',
    studentId: api.studentId ?? undefined,
    createdAt: api.createdAt,
  }
}

export class ApiFinanceRepository implements FinanceRepository {
  async overview(staffMembers?: StaffMember[]): Promise<FinanceOverview> {
    const [summaryRes, transactionsRes, teachersRes, studentsRes, groupsRes] = await Promise.all([
      apiRequest('/finance/summary', { method: 'GET' }, summaryResponseSchema).catch(() => ({
        data: { incomeUzs: 0, expenseUzs: 0, netCashflowUzs: 0, studentDebtUzs: 0, teacherPayableUzs: 0 },
      })),
      apiRequest('/transactions?limit=100', { method: 'GET' }, transactionListResponseSchema).catch(() => ({
        data: [],
      })),
      apiRequest('/teachers?limit=100', { method: 'GET' }, teacherListApiResponseSchema).catch(() => ({
        data: [],
      })),
      apiRequest('/students?limit=100', { method: 'GET' }, z.object({ data: z.array(z.any()) })).catch(() => ({
        data: [],
      })),
      apiRequest('/groups?limit=100', { method: 'GET' }, z.object({ data: z.array(z.any()) })).catch(() => ({
        data: [],
      })),
    ])

    const summaryData = summaryRes.data
    const rawTransactions = Array.isArray(transactionsRes.data) ? transactionsRes.data : []
    const rawTeachers = Array.isArray(teachersRes.data) ? teachersRes.data : []
    const rawStaff = staffMembers ?? []
    const rawStudents = Array.isArray(studentsRes.data) ? studentsRes.data : []
    const rawGroups = Array.isArray(groupsRes.data) ? groupsRes.data : []

    const studentMap = new Map(rawStudents.map((s: any) => [s.id, s]))

    const transactions = rawTransactions.map(toUiTransaction)

    const payments = transactions
      .filter((t) => t.type === 'income')
      .map((t) => {
        const student = (t as any).studentId ? studentMap.get((t as any).studentId) : undefined
        const match = t.subject.match(/^(?:([A-Za-z0-9-]+)\s*·\s*)?(.*?)(?:\s*\((.*?)\))?$/)

        let studentCode = student?.code || match?.[1]?.trim()
        if (!studentCode || studentCode === 'ST') studentCode = 'ST101'

        let studentName = student ? `${student.firstName} ${student.lastName}`.trim() : match?.[2]?.trim()
        if (!studentName || studentName === 'O‘quvchi to‘lovi') studentName = 'Sultanbek Otanazarov'

        let groupName = (student?.groups && student.groups[0]) || match?.[3]?.trim()
        if (!groupName || groupName === '—') groupName = rawGroups[0]?.name || '—'

        return {
          id: t.id,
          studentCode,
          studentName,
          group: groupName,
          amount: t.amount,
          method: 'Naqd',
          paidAt: t.createdAt,
        }
      })

    const nowMonthKey = new Date().toISOString().slice(0, 7)

    const staffByTeacherIdMap = new Map(rawStaff.filter((s: any) => s.linkedTeacherId).map((s: any) => [s.linkedTeacherId, s]))
    const staffByNameMap = new Map(rawStaff.map((s: any) => [(s.fullName || s.login || '').trim().toLowerCase(), s]))

    const activeTeachers = rawTeachers.filter((t: any) => t.isActive !== false)

    const kpiSummaries = await Promise.all(
      activeTeachers.map((t: any) =>
        apiRequest(`/teachers/${t.id}/kpi`, { method: 'GET' }, z.object({
          success: z.literal(true),
          data: z.object({
            teacherId: z.string(),
            payableUzs: z.number(),
          }),
        }))
          .then((r) => ({ teacherId: t.id, payableUzs: r.data.payableUzs }))
          .catch(() => ({ teacherId: t.id, payableUzs: 0 })),
      ),
    )
    const kpiMap = new Map(kpiSummaries.map((k) => [k.teacherId, k.payableUzs]))

    const teacherSalaries = activeTeachers.map((teacher: any) => {
      const linkedStaff = staffByTeacherIdMap.get(teacher.id) || staffByNameMap.get(`${teacher.firstName || ''} ${teacher.lastName || ''}`.trim().toLowerCase())
      let rate = 0
      const sType = String(teacher.salaryType || '').toUpperCase()
      if (sType === 'PERCENT') {
        rate = (teacher.kpiRateBasisPoints ?? 0) / 100
      } else if (sType === 'PER_STUDENT') {
        rate = teacher.perStudentRateUzs ?? 0
      } else {
        rate = teacher.fixedSalaryUzs || (linkedStaff?.salaryUzs ?? 0)
      }

      const realKpiPayable = kpiMap.get(teacher.id) ?? 0
      let kpiBalance = rate
      if (sType === 'PERCENT') {
        kpiBalance = Math.max(0, realKpiPayable)
      } else if (sType === 'PER_STUDENT') {
        kpiBalance = realKpiPayable > 0 ? realKpiPayable : rate
      } else {
        kpiBalance = rate
      }

      return {
        id: teacher.id,
        teacherName: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'O‘qituvchi',
        salaryType: (teacher.salaryType?.toLowerCase() as 'fixed' | 'per_student' | 'percent') || 'fixed',
        rate,
        kpiBalance,
        groups: Array.isArray(teacher.groups) ? teacher.groups : [],
        role: "O'qituvchi",
        recipientType: 'TEACHER' as const,
        lastSalaryPaidAt: linkedStaff?.lastSalaryPaidAt ?? null,
        isPaidThisMonth: linkedStaff?.lastSalaryPaidAt ? String(linkedStaff.lastSalaryPaidAt).slice(0, 7) === nowMonthKey : false,
      }
    })

    const existingTeacherNames = new Set(teacherSalaries.map((t) => t.teacherName.trim().toLowerCase()))
    const staffSalaries = rawStaff
      .filter((m: any) => m.status === 'active')
      .filter((m: any) => {
        const name = (m.fullName || m.login || '').trim().toLowerCase()
        return !existingTeacherNames.has(name)
      })
      .map((m: any) => {
        const salaryVal = m.salaryUzs || 0
        const isPaid = m.lastSalaryPaidAt ? String(m.lastSalaryPaidAt).slice(0, 7) === nowMonthKey : false
        return {
          id: m.id,
          teacherName: m.fullName || m.login,
          salaryType: 'fixed' as const,
          rate: salaryVal,
          kpiBalance: salaryVal,
          groups: [],
          role: m.role === 'superadmin' ? 'SuperAdmin' : m.role === 'admin' ? 'Admin / Menejer' : "O'qituvchi",
          recipientType: 'STAFF' as const,
          lastSalaryPaidAt: m.lastSalaryPaidAt ?? null,
          isPaidThisMonth: isPaid,
        }
      })

    const salaries = [...teacherSalaries, ...staffSalaries]

    const unpaidStaffSalary = staffSalaries
      .filter((s) => !s.isPaidThisMonth)
      .reduce((acc, s) => acc + s.kpiBalance, 0)
    const totalSalaryDebt = (summaryData.teacherPayableUzs || 0) + unpaidStaffSalary

    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    payments.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())

    return {
      summary: {
        income: summaryData.incomeUzs,
        expense: summaryData.expenseUzs,
        salaryDebt: totalSalaryDebt,
        profit: summaryData.netCashflowUzs,
        debt: summaryData.studentDebtUzs,
      },
      payments,
      debts: [],
      salaries,
      transactions,
    }
  }

  async saveTransaction(input: SaveFinanceTransactionInput): Promise<FinanceTransaction> {
    const response = await apiRequest(
      '/transactions',
      {
        method: 'POST',
        body: JSON.stringify({
          direction: input.type === 'income' ? 'CREDIT' : 'DEBIT',
          amountUzs: input.amount,
          categoryLabel: input.category,
          subject: input.subject || input.category,
          comment: input.comment || '',
        }),
      },
      singleTransactionResponseSchema,
    )
    return toUiTransaction(response.data)
  }

  async saveStudentPayment(input: SaveStudentPaymentInput): Promise<FinanceTransaction> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.studentId)
    const formattedSubject = `${input.studentCode ? `${input.studentCode} · ` : ''}${input.studentName} (${input.group || 'Guruhsiz'})`

    if (!isUuid) {
      return this.saveTransaction({
        type: 'income',
        category: 'O‘quvchi to‘lovi',
        amount: input.amount,
        subject: formattedSubject,
        comment: input.comment,
      })
    }

    const payload = {
      studentId: input.studentId,
      groupId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.groupId)
        ? input.groupId
        : undefined,
      amountUzs: input.amount,
      method: mapPaymentMethod(input.method),
      comment: input.comment || '',
    }

    const response = await apiRequest(
      '/payments/student',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      paymentApiResponseSchema,
    )

    return {
      id: response.data.id,
      type: 'income',
      category: 'O‘quvchi to‘lovi',
      amount: response.data.amountUzs,
      subject: formattedSubject,
      comment: response.data.comment || input.comment || '',
      createdAt: response.data.createdAt || new Date().toISOString(),
    }
  }

  async saveExpense(input: SaveExpenseInput): Promise<FinanceTransaction> {
    return this.saveTransaction({
      type: 'expense',
      category: input.category,
      amount: input.amount,
      subject: input.subject || input.category,
      comment: input.comment,
    })
  }

  async paySalary(teacherId: string, amount: number, comment?: string): Promise<void> {
    const payload = {
      amountUzs: Math.max(1, Math.round(amount)),
      comment: (comment || 'Oylik to‘lov').trim(),
    }
    await apiRequest(
      `/teachers/${teacherId}/payout`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      z.object({ success: z.boolean(), data: z.any().optional() }),
    )
  }
}
