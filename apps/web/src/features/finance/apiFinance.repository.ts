import {
  paginationMetaSchema,
  teacherApiSchema,
  type FinanceOverview,
  type FinanceTransaction,
  type StaffMember,
} from '@golden-study/contracts'
import { z } from 'zod'

import { apiRequest } from '../../shared/api/httpClient'
import { getLocalStaffPayouts } from '../../shared/lib/staffPayoutStore'
import type {
  FinanceRepository,
  SaveExpenseInput,
  SaveFinanceTransactionInput,
  SaveStudentPaymentInput,
} from './finance.repository'

const summarySchema = z.object({
  totalIncomeUzs: z.number().default(0),
  totalExpenseUzs: z.number().default(0),
  totalPendingSalaryUzs: z.number().default(0),
  netProfitUzs: z.number().default(0),
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
  } else if (category === 'STAFF_PAYOUT') {
    category = 'Xodimlar ish haqi'
    if (!subject || subject === 'Xarajat' || subject === 'STAFF_PAYOUT') {
      const loginMatch = api.comment?.match(/\(([^)]+)\)$/)
      subject = loginMatch ? `@${loginMatch[1]}` : 'Xodim'
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
        data: { totalIncomeUzs: 0, totalExpenseUzs: 0, totalPendingSalaryUzs: 0, netProfitUzs: 0 },
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

    const teacherSalaries = rawTeachers.filter((t: any) => t.isActive !== false).map((teacher) => {
      const linkedStaff = staffByTeacherIdMap.get(teacher.id) || staffByNameMap.get(`${teacher.firstName || ''} ${teacher.lastName || ''}`.trim().toLowerCase())
      let rate = teacher.fixedSalaryUzs || teacher.perStudentRateUzs || teacher.kpiRateBasisPoints || 0
      if (linkedStaff && linkedStaff.salaryUzs !== undefined && linkedStaff.salaryUzs !== null && linkedStaff.salaryUzs > 0) {
        const sType = String(teacher.salaryType || '').toUpperCase()
        if (!teacher.salaryType || sType === 'FIXED') {
          rate = linkedStaff.salaryUzs
        }
      }
      return {
        id: teacher.id,
        teacherName: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'O‘qituvchi',
        salaryType: (teacher.salaryType?.toLowerCase() as 'fixed' | 'per_student' | 'percent') || 'fixed',
        rate,
        kpiBalance: rate,
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

    const localPayouts = getLocalStaffPayouts()
    const localTransactions: FinanceTransaction[] = localPayouts.map((p) => ({
      id: p.id,
      type: 'expense',
      category: 'Xodimlar ish haqi',
      amount: p.amount,
      subject: `${p.staffName} (@${p.staffLogin})`,
      comment: p.comment,
      createdAt: p.paidAt,
    }))

    const existingIds = new Set(transactions.map((t) => t.id))
    const mergedTransactions = [...transactions]
    for (const lt of localTransactions) {
      if (existingIds.has(lt.id)) continue
      const isAlreadyOnServer = transactions.some((st) => {
        if (st.category !== 'Xodimlar ish haqi' || st.amount !== lt.amount) return false
        const diffMs = Math.abs(new Date(st.createdAt).getTime() - new Date(lt.createdAt).getTime())
        return diffMs < 120_000
      })
      if (!isAlreadyOnServer) {
        mergedTransactions.unshift(lt)
      }
    }

    mergedTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    payments.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())

    const totalIncome = summaryData.totalIncomeUzs || mergedTransactions.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0)
    const totalExpense = summaryData.totalExpenseUzs || mergedTransactions.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)

    return {
      summary: {
        income: totalIncome,
        expense: totalExpense,
        salaryDebt: summaryData.totalPendingSalaryUzs || 0,
        profit: summaryData.netProfitUzs || (totalIncome - totalExpense),
        debt: 0,
      },
      payments,
      debts: [],
      salaries,
      transactions: mergedTransactions,
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

  async paySalary(teacherId: string): Promise<void> {
    try {
      await apiRequest(
        `/teachers/${teacherId}/payout`,
        {
          method: 'POST',
          body: JSON.stringify({
            comment: 'Oylik to‘lov',
          }),
        },
        z.object({ success: z.boolean() }),
      )
    } catch (_err) {
      // Offline fallback
    }
  }
}
