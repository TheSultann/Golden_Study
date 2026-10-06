import {
  paginationMetaSchema,
  teacherApiSchema,
  type FinanceDebt,
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

export const transactionApiSchema = z.object({
  id: z.string(),
  direction: z.enum(['CREDIT', 'DEBIT']),
  accountType: z.enum(['STUDENT', 'TEACHER', 'CENTER']).nullable().optional(),
  category: z.string().optional().default('OTHER'),
  amountUzs: z.number(),
  categoryLabel: z.string().optional().default(''),
  subject: z.string().optional().default(''),
  comment: z.string().optional().default(''),
  studentId: z.string().nullable().optional(),
  teacherId: z.string().nullable().optional(),
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

const debtorListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      studentId: z.string(),
      studentCode: z.string().optional(),
      studentName: z.string().optional(),
      balanceUzs: z.number().int().optional(),
      debtUzs: z.number().int().optional(),
    }),
  ),
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

export function formatTransactionComment(rawComment: string | null | undefined): string {
  if (!rawComment) return ''
  const trimmed = rawComment.trim()

  // Fixed KPI YYYY-MM -> Oylik maosh / oklad (MM.YYYY)
  const fixedKpiMatch = trimmed.match(/^Fixed KPI\s+(\d{4})-(\d{2})/i)
  if (fixedKpiMatch) {
    const [, y, m] = fixedKpiMatch
    return `Oylik maosh / oklad (${m}.${y})`
  }

  // Per-student KPI YYYY-MM -> O‘quvchi soni hisoblash (MM.YYYY)
  const perStudentKpiMatch = trimmed.match(/^Per-student KPI\s+(\d{4})-(\d{2})/i)
  if (perStudentKpiMatch) {
    const [, y, m] = perStudentKpiMatch
    return `O‘quvchi soni hisoblash (${m}.${y})`
  }

  if (trimmed === 'Percent KPI accrual') {
    return 'Foiz hisoblash'
  }

  if (trimmed === 'KPI source charge reversed') {
    return 'KPI qaytarildi (manba dars bekor qilindi)'
  }

  // Attendance CAME 2026-09-22 -> Davomat: Keldi (22.09.2026)
  const cameMatch = trimmed.match(/^Attendance CAME\s+(\d{4}-\d{2}-\d{2})/i)
  if (cameMatch) {
    const [y, m, d] = cameMatch[1].split('-')
    return `Davomat: Keldi (${d}.${m}.${y})`
  }

  // Attendance ABSENT 2026-09-22 -> Davomat: Sababsiz (22.09.2026)
  const absentMatch = trimmed.match(/^Attendance ABSENT\s+(\d{4}-\d{2}-\d{2})/i)
  if (absentMatch) {
    const [y, m, d] = absentMatch[1].split('-')
    return `Davomat: Sababsiz (${d}.${m}.${y})`
  }

  // Attendance EXCUSED -> Davomat: Sababli (mablag‘ qaytarildi)
  const excusedMatch = trimmed.match(/^Attendance EXCUSED(?:\s+(\d{4}-\d{2}-\d{2}))?/i)
  if (excusedMatch) {
    if (excusedMatch[1]) {
      const [y, m, d] = excusedMatch[1].split('-')
      return `Davomat: Sababli (${d}.${m}.${y}, mablag‘ qaytarildi)`
    }
    return 'Davomat: Sababli (mablag‘ qaytarildi)'
  }

  if (trimmed === 'Attendance reversed') {
    return 'Davomat bekor qilindi (mablag‘ qaytarildi)'
  }

  return trimmed
}

export type TransactionApiInput = z.input<typeof transactionApiSchema>

export function toUiTransaction(
  api: TransactionApiInput,
  studentMap?: Map<string, any>,
  teacherMap?: Map<string, any>,
): FinanceTransaction {
  const rawCategory = api.category || 'OTHER'

  let accountType = api.accountType
  if (!accountType) {
    if (
      api.teacherId ||
      [
        'KPI_FIXED_ACCRUAL',
        'KPI_PERCENT_ACCRUAL',
        'KPI_PER_STUDENT_ACCRUAL',
        'TEACHER_PAYOUT',
      ].includes(rawCategory)
    ) {
      accountType = 'TEACHER'
    } else if (
      api.studentId ||
      (rawCategory === 'STUDENT_PAYMENT' && api.direction === 'CREDIT') ||
      [
        'DAILY_LESSON_CHARGE',
        'MONTHLY_TUITION_CHARGE',
      ].includes(rawCategory)
    ) {
      accountType = 'STUDENT'
    } else if (
      ['MANUAL_INCOME', 'MANUAL_EXPENSE', 'STAFF_PAYOUT'].includes(rawCategory)
    ) {
      accountType = 'CENTER'
    }
  }

  let type: 'income' | 'expense' = api.direction === 'CREDIT' ? 'income' : 'expense'
  let category = api.categoryLabel || rawCategory
  let subject = api.subject || ''

  const student = api.studentId && studentMap ? studentMap.get(api.studentId) : undefined
  const studentFullName = student
    ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
    : null

  const teacher = api.teacherId && teacherMap ? teacherMap.get(api.teacherId) : undefined
  const teacherFullName = teacher
    ? `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim()
    : null

  if (accountType === 'TEACHER') {
    type = 'expense'

    if (rawCategory === 'KPI_FIXED_ACCRUAL') {
      category = 'O‘qituvchi oyligi (Oklad)'
    } else if (rawCategory === 'KPI_PERCENT_ACCRUAL') {
      category = 'O‘qituvchi oyligi (Foiz hisoblash)'
    } else if (rawCategory === 'KPI_PER_STUDENT_ACCRUAL') {
      category = 'O‘qituvchi oyligi (O‘quvchi soni hisoblash)'
    } else if (rawCategory === 'TEACHER_PAYOUT') {
      category = 'Xodimlar ish haqi (To‘langan)'
    } else if (!api.categoryLabel || api.categoryLabel === rawCategory) {
      category = 'O‘qituvchi oyligi'
    }

    if (teacherFullName) {
      subject = teacherFullName
    } else if (
      subject &&
      subject !== 'Xarajat' &&
      subject !== 'O‘quvchi to‘lovi' &&
      subject !== 'TEACHER_PAYOUT' &&
      !subject.startsWith('KPI_')
    ) {
      subject = subject.replace(/^Xodimlar ish haqi:\s*/i, '')
    } else {
      const loginMatch = api.comment?.match(/\(([^)]+)\)$/)
      subject = loginMatch ? `@${loginMatch[1]}` : 'O‘qituvchi'
    }
  } else if (accountType === 'STUDENT') {
    if (rawCategory === 'STUDENT_PAYMENT') {
      type = 'income'
      category = 'O‘quvchi to‘lovi'
    } else if (rawCategory === 'DAILY_LESSON_CHARGE') {
      type = 'expense'
      category = 'Dars billingi'
    } else if (rawCategory === 'MONTHLY_TUITION_CHARGE') {
      type = 'expense'
      category = 'Oylik to‘lov billingi'
    } else if (rawCategory === 'ADJUSTMENT') {
      type = api.direction === 'CREDIT' ? 'income' : 'expense'
      category = 'Tuzatish (Balans to‘g‘rilash)'
    } else if (rawCategory === 'REVERSAL') {
      type = 'income'
      category = 'Bekor qilish (Dars qaytarildi)'
    } else if (!api.categoryLabel || api.categoryLabel === rawCategory) {
      category = type === 'income' ? 'O‘quvchi to‘lovi' : 'Dars billingi'
    }

    if (studentFullName) {
      subject = studentFullName
    } else if (
      subject &&
      subject !== 'Xarajat' &&
      subject !== 'O‘quvchi to‘lovi'
    ) {
      // keep existing subject
    } else if (rawCategory === 'DAILY_LESSON_CHARGE') {
      subject = 'Abonement yechildi'
    } else if (rawCategory === 'MONTHLY_TUITION_CHARGE') {
      subject = 'Oylik to‘lov'
    } else if (rawCategory === 'ADJUSTMENT') {
      subject = 'Davomat qayta hisoblandi'
    } else if (rawCategory === 'REVERSAL') {
      subject = 'Dars uchun mablag‘ qaytarildi'
    } else {
      subject = type === 'income' ? 'O‘quvchi to‘lovi' : 'O‘quvchi'
    }
  } else {
    // CENTER or other
    if (rawCategory === 'MANUAL_INCOME') {
      type = 'income'
      category = api.categoryLabel && api.categoryLabel !== 'MANUAL_INCOME' ? api.categoryLabel : 'Kirim'
      subject = subject || 'Kirim'
    } else if (rawCategory === 'MANUAL_EXPENSE') {
      type = 'expense'
      category = api.categoryLabel && api.categoryLabel !== 'MANUAL_EXPENSE' ? api.categoryLabel : 'Boshqa xarajat'
      subject = subject || 'Xarajat'
    } else if (rawCategory === 'STAFF_PAYOUT') {
      type = 'expense'
      category = 'Xodimlar ish haqi'
      if (!subject || subject === 'Xarajat' || subject === 'STAFF_PAYOUT') {
        const loginMatch = api.comment?.match(/\(([^)]+)\)$/)
        subject = loginMatch ? `@${loginMatch[1]}` : 'Xodim'
      } else {
        subject = subject.replace(/^Xodimlar ish haqi:\s*/i, '')
      }
    } else {
      type = api.direction === 'CREDIT' ? 'income' : 'expense'
      if (!api.categoryLabel || api.categoryLabel === rawCategory) {
        category = type === 'income' ? 'Kirim' : 'Boshqa xarajat'
      }
      if (!subject) {
        subject = type === 'income' ? 'Kirim' : 'Xarajat'
      }
    }
  }

  return {
    id: api.id,
    type,
    category,
    amount: api.amountUzs,
    subject,
    comment: formatTransactionComment(api.comment),
    studentId: api.studentId ?? undefined,
    createdAt: api.createdAt,
  }
}

export class ApiFinanceRepository implements FinanceRepository {
  async overview(staffMembers?: StaffMember[]): Promise<FinanceOverview> {
    const [summaryRes, transactionsRes, teachersRes, studentsRes, groupsRes, debtorsRes] = await Promise.all([
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
      apiRequest('/finance/debtors?limit=100', { method: 'GET' }, debtorListApiResponseSchema).catch(() => ({
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
    const teacherMap = new Map(rawTeachers.map((t: any) => [t.id, t]))
    for (const s of rawStaff) {
      if (s.linkedTeacherId && !teacherMap.has(s.linkedTeacherId)) {
        teacherMap.set(s.linkedTeacherId, {
          id: s.linkedTeacherId,
          firstName: s.fullName?.split(' ')[0] || s.login,
          lastName: s.fullName?.split(' ').slice(1).join(' ') || '',
        })
      }
      if (s.id && !teacherMap.has(s.id)) {
        teacherMap.set(s.id, {
          id: s.id,
          firstName: s.fullName?.split(' ')[0] || s.login,
          lastName: s.fullName?.split(' ').slice(1).join(' ') || '',
        })
      }
    }

    const transactions = rawTransactions.map((t) => toUiTransaction(t, studentMap, teacherMap))

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

    const rawDebtors = Array.isArray(debtorsRes?.data) ? debtorsRes.data : []
    const debts: FinanceDebt[] = rawDebtors.map((debtor) => {
      const student = studentMap.get(debtor.studentId)
      const studentGroups = Array.isArray(student?.activeGroups)
        ? student.activeGroups.map((g: any) => g.name || g)
        : Array.isArray(student?.groups)
          ? student.groups
          : []
      const groupName = studentGroups[0] || '—'
      const parentPhone = student?.parentPhone || student?.phone || '—'
      const studentCode = debtor.studentCode || student?.studentCode || student?.code || 'ST101'
      const studentName =
        debtor.studentName ||
        `${student?.firstName || ''} ${student?.lastName || ''}`.trim() ||
        'O‘quvchi'
      const balance = typeof debtor.balanceUzs === 'number'
        ? debtor.balanceUzs
        : debtor.debtUzs
          ? -debtor.debtUzs
          : 0

      return {
        id: debtor.studentId,
        studentCode,
        studentName,
        group: groupName,
        parentPhone,
        balance,
      }
    })

    if (debts.length === 0 && rawStudents.length > 0) {
      for (const student of rawStudents) {
        if (typeof student.balance === 'number' && student.balance < 0) {
          const studentGroups = Array.isArray(student.activeGroups)
            ? student.activeGroups.map((g: any) => g.name || g)
            : Array.isArray(student.groups)
              ? student.groups
              : []
          debts.push({
            id: student.id,
            studentCode: student.studentCode || student.code || 'ST101',
            studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'O‘quvchi',
            group: studentGroups[0] || '—',
            parentPhone: student.parentPhone || student.phone || '—',
            balance: student.balance,
          })
        }
      }
    }

    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    payments.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    debts.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))

    return {
      summary: {
        income: summaryData.incomeUzs,
        expense: summaryData.expenseUzs,
        salaryDebt: totalSalaryDebt,
        profit: summaryData.netCashflowUzs,
        debt: summaryData.studentDebtUzs,
      },
      payments,
      debts,
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
