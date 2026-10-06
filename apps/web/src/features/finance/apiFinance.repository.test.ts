import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ApiFinanceRepository,
  formatTransactionComment,
  toUiTransaction,
} from './apiFinance.repository'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const mockSummaryApi = {
  incomeUzs: 10_000_000,
  expenseUzs: 2_000_000,
  netCashflowUzs: 8_000_000,
  studentDebtUzs: 500_000,
  teacherPayableUzs: 3_000_000,
}

const mockTransactionApi = {
  id: '44444444-4444-4444-8444-444444444444',
  direction: 'CREDIT' as const,
  category: 'STUDENT_PAYMENT',
  amountUzs: 500_000,
  categoryLabel: 'To‘lov',
  subject: 'Ali Valiyev',
  comment: 'Naqd',
  createdAt: '2026-07-21T10:00:00.000Z',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ApiFinanceRepository', () => {
  it('fetches finance summary and transaction list', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/finance/summary')) {
        return Promise.resolve(jsonResponse({ success: true, data: mockSummaryApi }))
      }
      if (url.includes('/transactions')) {
        return Promise.resolve(jsonResponse({ success: true, data: [mockTransactionApi] }))
      }
      return Promise.resolve(jsonResponse({ success: false }, 404))
    })

    vi.stubGlobal('fetch', fetchMock)

    const repository = new ApiFinanceRepository()
    const result = await repository.overview()

    expect(result.summary.income).toBe(10_000_000)
    expect(result.summary.expense).toBe(2_000_000)
    expect(result.summary.profit).toBe(8_000_000)
    expect(result.summary.salaryDebt).toBe(3_000_000)
    expect(result.transactions.length).toBe(1)
    expect(result.transactions[0].type).toBe('income')
  })

  it('maps teacher salary with percent rate and fetches real kpiBalance', async () => {
    const teacherId = '77777777-7777-4777-8777-777777777777'
    const mockTeacher = {
      id: teacherId,
      firstName: 'Aziz',
      lastName: 'Karimov',
      phone: '+998901234567',
      salaryType: 'PERCENT',
      kpiRateBasisPoints: 4500,
      fixedSalaryUzs: null,
      perStudentRateUzs: null,
      login: 'aziz.karimov',
      isActive: true,
      groupsCount: 1,
      groups: ['ENG-1'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const mockKpi = {
      teacherId,
      creditsUzs: 3_500_000,
      debitsUzs: 500_000,
      payableUzs: 3_000_000,
    }
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/finance/summary')) {
        return Promise.resolve(jsonResponse({ success: true, data: mockSummaryApi }))
      }
      if (url.includes('/teachers?') || url.endsWith('/teachers')) {
        return Promise.resolve(jsonResponse({ success: true, data: [mockTeacher] }))
      }
      if (url.includes(`/teachers/${teacherId}/kpi`)) {
        return Promise.resolve(jsonResponse({ success: true, data: mockKpi }))
      }
      if (url.includes('/transactions')) {
        return Promise.resolve(jsonResponse({ success: true, data: [] }))
      }
      return Promise.resolve(jsonResponse({ success: false }, 404))
    })
    vi.stubGlobal('fetch', fetchMock)

    const repository = new ApiFinanceRepository()
    const result = await repository.overview()

    const teacher = result.salaries.find((s) => s.id === teacherId)
    expect(teacher).toBeDefined()
    expect(teacher?.salaryType).toBe('percent')
    expect(teacher?.rate).toBe(45) // 4500 basis points / 100 = 45%
    expect(teacher?.kpiBalance).toBe(3_000_000) // fetched from /kpi payableUzs
  })

  it('maps student debts from /finance/debtors and matches with student details', async () => {
    const debtorStudentId = '96f82cd3-6484-4c56-8558-77c75ae08be3'
    const mockStudent = {
      id: debtorStudentId,
      studentCode: 'ST101',
      firstName: 'Student',
      lastName: 'Studentov',
      phone: '+998901112233',
      parentPhone: '+998909998877',
      activeGroups: [{ id: 'g1', name: 'IELTS-24-01' }],
    }
    const mockDebtors = [
      {
        studentId: debtorStudentId,
        studentCode: 'ST101',
        studentName: 'Student Studentov',
        balanceUzs: -76924,
        debtUzs: 76924,
      },
    ]

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/finance/summary')) {
        return Promise.resolve(jsonResponse({ success: true, data: { ...mockSummaryApi, studentDebtUzs: 76924 } }))
      }
      if (url.includes('/finance/debtors')) {
        return Promise.resolve(jsonResponse({ success: true, data: mockDebtors }))
      }
      if (url.includes('/students')) {
        return Promise.resolve(jsonResponse({ success: true, data: [mockStudent] }))
      }
      return Promise.resolve(jsonResponse({ success: true, data: [] }))
    })

    vi.stubGlobal('fetch', fetchMock)

    const repository = new ApiFinanceRepository()
    const result = await repository.overview()

    expect(result.summary.debt).toBe(76924)
    expect(result.debts.length).toBe(1)
    expect(result.debts[0].studentName).toBe('Student Studentov')
    expect(result.debts[0].studentCode).toBe('ST101')
    expect(result.debts[0].group).toBe('IELTS-24-01')
    expect(result.debts[0].parentPhone).toBe('+998909998877')
    expect(result.debts[0].balance).toBe(-76924)
  })

  it('saves expense transaction via POST /transactions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...mockTransactionApi,
          direction: 'DEBIT',
          categoryLabel: 'Ijara',
          amountUzs: 1_000_000,
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const repository = new ApiFinanceRepository()
    const result = await repository.saveExpense({
      category: 'Ijara',
      subject: 'Ofis ijarasi',
      amount: 1_000_000,
      comment: 'Iyul',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/transactions'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          direction: 'DEBIT',
          amountUzs: 1_000_000,
          categoryLabel: 'Ijara',
          subject: 'Ofis ijarasi',
          comment: 'Iyul',
        }),
      }),
    )
    expect(result.type).toBe('expense')
  })

  it('saves student payment via POST /payments/student when valid UUID', async () => {
    const studentId = '55555555-5555-4555-8555-555555555555'
    const groupId = '66666666-6666-4666-8666-666666666666'

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          id: 'pay-123',
          studentId,
          groupId,
          amountUzs: 500_000,
          method: 'CASH',
          comment: 'Iyul to‘lovi',
          createdAt: '2026-07-21T10:00:00.000Z',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const repository = new ApiFinanceRepository()
    await repository.saveStudentPayment({
      studentId,
      groupId,
      studentCode: 'ST101',
      studentName: 'Ali Valiyev',
      group: 'ENG-101',
      method: 'cash',
      amount: 500_000,
      comment: 'Iyul to‘lovi',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/payments/student'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          studentId,
          groupId,
          amountUzs: 500_000,
          method: 'CASH',
          comment: 'Iyul to‘lovi',
        }),
      }),
    )
  })

  it('calls POST /teachers/:id/payout with amountUzs and comment when paySalary is invoked', async () => {
    const teacherId = '77777777-7777-4777-8777-777777777777'
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { id: 'payout-1', amountUzs: 2_500_000 },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const repository = new ApiFinanceRepository()
    await repository.paySalary(teacherId, 2_500_000, 'Sentabr oylik')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/teachers/${teacherId}/payout`),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          amountUzs: 2_500_000,
          comment: 'Sentabr oylik',
        }),
      }),
    )
  })

  it('correctly maps teacher KPI accruals and does not contaminate payments in overview', async () => {
    const teacherId = '77777777-7777-4777-8777-777777777777'
    const studentId = '55555555-5555-4555-8555-555555555555'

    const mockTeacher = {
      id: teacherId,
      firstName: 'Sardor',
      lastName: 'Rahimov',
      phone: '+998901112233',
      salaryType: 'FIXED',
      fixedSalaryUzs: 2_000_000,
      kpiRateBasisPoints: null,
      perStudentRateUzs: null,
      login: 'sardor.rahimov',
      isActive: true,
      groupsCount: 1,
      groups: ['ENG-1'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const mockStudent = {
      id: studentId,
      code: 'ST101',
      firstName: 'Jasur',
      lastName: 'Aliyev',
      groups: ['ENG-1'],
    }

    const mockTransactions = [
      {
        id: 'tx-kpi-1',
        direction: 'CREDIT' as const,
        accountType: 'TEACHER' as const,
        teacherId,
        category: 'KPI_FIXED_ACCRUAL',
        amountUzs: 2_000_000,
        comment: 'Fixed KPI 2026-09',
        createdAt: '2026-09-01T10:00:00.000Z',
      },
      {
        id: 'tx-pay-1',
        direction: 'CREDIT' as const,
        accountType: 'STUDENT' as const,
        studentId,
        category: 'STUDENT_PAYMENT',
        amountUzs: 600_000,
        comment: 'Naqd to‘lov',
        createdAt: '2026-09-02T10:00:00.000Z',
      },
    ]

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/finance/summary')) {
        return Promise.resolve(jsonResponse({ success: true, data: mockSummaryApi }))
      }
      if (url.includes('/teachers?') || url.endsWith('/teachers')) {
        return Promise.resolve(jsonResponse({ success: true, data: [mockTeacher] }))
      }
      if (url.includes('/students')) {
        return Promise.resolve(jsonResponse({ success: true, data: [mockStudent] }))
      }
      if (url.includes('/groups')) {
        return Promise.resolve(jsonResponse({ success: true, data: [{ id: 'g-1', name: 'ENG-1' }] }))
      }
      if (url.includes('/transactions')) {
        return Promise.resolve(jsonResponse({ success: true, data: mockTransactions }))
      }
      return Promise.resolve(jsonResponse({ success: false }, 404))
    })

    vi.stubGlobal('fetch', fetchMock)

    const repository = new ApiFinanceRepository()
    const result = await repository.overview()

    // 1. KPI Fixed Accrual must be classified as 'expense' (Chiqim)
    const kpiTx = result.transactions.find((t) => t.id === 'tx-kpi-1')
    expect(kpiTx).toBeDefined()
    expect(kpiTx?.type).toBe('expense')
    expect(kpiTx?.category).toBe('O‘qituvchi oyligi (Oklad)')
    expect(kpiTx?.subject).toBe('Sardor Rahimov')
    expect(kpiTx?.comment).toBe('Oylik maosh / oklad (09.2026)')
    expect(kpiTx?.amount).toBe(2_000_000)

    // 2. Student payment must be classified as 'income' (Kirim)
    const payTx = result.transactions.find((t) => t.id === 'tx-pay-1')
    expect(payTx).toBeDefined()
    expect(payTx?.type).toBe('income')
    expect(payTx?.category).toBe('O‘quvchi to‘lovi')
    expect(payTx?.subject).toBe('Jasur Aliyev')

    // 3. Payments list must ONLY contain student payments, NOT teacher salary accruals
    expect(result.payments.length).toBe(1)
    expect(result.payments[0].id).toBe('tx-pay-1')
    expect(result.payments[0].studentName).toBe('Jasur Aliyev')
  })
})

describe('toUiTransaction mapping audit', () => {
  const teacherMap = new Map([
    [
      'teacher-1',
      { id: 'teacher-1', firstName: 'Dilshod', lastName: 'Xalilov' },
    ],
  ])

  const studentMap = new Map([
    [
      'student-1',
      { id: 'student-1', firstName: 'Olim', lastName: 'Qodirov' },
    ],
  ])

  describe('accountType: TEACHER', () => {
    it('maps KPI_FIXED_ACCRUAL correctly', () => {
      const tx = toUiTransaction(
        {
          id: '1',
          direction: 'CREDIT',
          accountType: 'TEACHER',
          teacherId: 'teacher-1',
          category: 'KPI_FIXED_ACCRUAL',
          amountUzs: 3_000_000,
          comment: 'Fixed KPI 2026-08',
          createdAt: '2026-08-01T00:00:00.000Z',
        },
        studentMap,
        teacherMap,
      )

      expect(tx.type).toBe('expense')
      expect(tx.category).toBe('O‘qituvchi oyligi (Oklad)')
      expect(tx.subject).toBe('Dilshod Xalilov')
      expect(tx.comment).toBe('Oylik maosh / oklad (08.2026)')
      expect(tx.amount).toBe(3_000_000)
    })

    it('maps KPI_PERCENT_ACCRUAL correctly', () => {
      const tx = toUiTransaction(
        {
          id: '2',
          direction: 'CREDIT',
          accountType: 'TEACHER',
          teacherId: 'teacher-1',
          category: 'KPI_PERCENT_ACCRUAL',
          amountUzs: 1_250_000,
          comment: 'Percent KPI accrual',
          createdAt: '2026-08-02T00:00:00.000Z',
        },
        studentMap,
        teacherMap,
      )

      expect(tx.type).toBe('expense')
      expect(tx.category).toBe('O‘qituvchi oyligi (Foiz hisoblash)')
      expect(tx.subject).toBe('Dilshod Xalilov')
      expect(tx.comment).toBe('Foiz hisoblash')
    })

    it('maps KPI_PER_STUDENT_ACCRUAL correctly', () => {
      const tx = toUiTransaction(
        {
          id: '3',
          direction: 'CREDIT',
          accountType: 'TEACHER',
          teacherId: 'teacher-1',
          category: 'KPI_PER_STUDENT_ACCRUAL',
          amountUzs: 1_800_000,
          comment: 'Per-student KPI 2026-08',
          createdAt: '2026-08-03T00:00:00.000Z',
        },
        studentMap,
        teacherMap,
      )

      expect(tx.type).toBe('expense')
      expect(tx.category).toBe('O‘qituvchi oyligi (O‘quvchi soni hisoblash)')
      expect(tx.subject).toBe('Dilshod Xalilov')
      expect(tx.comment).toBe('O‘quvchi soni hisoblash (08.2026)')
    })

    it('maps TEACHER_PAYOUT correctly', () => {
      const tx = toUiTransaction(
        {
          id: '4',
          direction: 'DEBIT',
          accountType: 'TEACHER',
          teacherId: 'teacher-1',
          category: 'TEACHER_PAYOUT',
          amountUzs: 2_000_000,
          comment: 'Avans berildi',
          createdAt: '2026-08-15T00:00:00.000Z',
        },
        studentMap,
        teacherMap,
      )

      expect(tx.type).toBe('expense')
      expect(tx.category).toBe('Xodimlar ish haqi (To‘langan)')
      expect(tx.subject).toBe('Dilshod Xalilov')
    })

    it('falls back to O‘qituvchi when teacherId is not in teacherMap and no name is available', () => {
      const tx = toUiTransaction(
        {
          id: '5',
          direction: 'CREDIT',
          accountType: 'TEACHER',
          teacherId: 'unknown-id',
          category: 'KPI_FIXED_ACCRUAL',
          amountUzs: 2_000_000,
          createdAt: '2026-08-01T00:00:00.000Z',
        },
        studentMap,
        teacherMap,
      )

      expect(tx.type).toBe('expense')
      expect(tx.subject).toBe('O‘qituvchi')
      expect(tx.subject).not.toBe('O‘quvchi to‘lovi')
    })
  })

  describe('accountType: STUDENT', () => {
    it('maps STUDENT_PAYMENT as income with student name', () => {
      const tx = toUiTransaction(
        {
          id: 's-1',
          direction: 'CREDIT',
          accountType: 'STUDENT',
          studentId: 'student-1',
          category: 'STUDENT_PAYMENT',
          amountUzs: 500_000,
          createdAt: '2026-08-01T00:00:00.000Z',
        },
        studentMap,
        teacherMap,
      )

      expect(tx.type).toBe('income')
      expect(tx.category).toBe('O‘quvchi to‘lovi')
      expect(tx.subject).toBe('Olim Qodirov')
    })

    it('maps DAILY_LESSON_CHARGE as expense with student name', () => {
      const tx = toUiTransaction(
        {
          id: 's-2',
          direction: 'DEBIT',
          accountType: 'STUDENT',
          studentId: 'student-1',
          category: 'DAILY_LESSON_CHARGE',
          amountUzs: 50_000,
          comment: 'Attendance CAME 2026-08-10',
          createdAt: '2026-08-10T00:00:00.000Z',
        },
        studentMap,
        teacherMap,
      )

      expect(tx.type).toBe('expense')
      expect(tx.category).toBe('Dars billingi')
      expect(tx.subject).toBe('Olim Qodirov')
      expect(tx.comment).toBe('Davomat: Keldi (10.08.2026)')
    })

    it('maps MONTHLY_TUITION_CHARGE as expense with student name', () => {
      const tx = toUiTransaction(
        {
          id: 's-3',
          direction: 'DEBIT',
          accountType: 'STUDENT',
          studentId: 'student-1',
          category: 'MONTHLY_TUITION_CHARGE',
          amountUzs: 600_000,
          createdAt: '2026-08-01T00:00:00.000Z',
        },
        studentMap,
        teacherMap,
      )

      expect(tx.type).toBe('expense')
      expect(tx.category).toBe('Oylik to‘lov billingi')
      expect(tx.subject).toBe('Olim Qodirov')
    })

    it('maps ADJUSTMENT CREDIT as income and DEBIT as expense', () => {
      const txCredit = toUiTransaction(
        {
          id: 's-4',
          direction: 'CREDIT',
          accountType: 'STUDENT',
          studentId: 'student-1',
          category: 'ADJUSTMENT',
          amountUzs: 30_000,
          createdAt: '2026-08-12T00:00:00.000Z',
        },
        studentMap,
        teacherMap,
      )
      expect(txCredit.type).toBe('income')
      expect(txCredit.category).toBe('Tuzatish (Balans to‘g‘rilash)')
      expect(txCredit.subject).toBe('Olim Qodirov')

      const txDebit = toUiTransaction(
        {
          id: 's-5',
          direction: 'DEBIT',
          accountType: 'STUDENT',
          studentId: 'student-1',
          category: 'ADJUSTMENT',
          amountUzs: 30_000,
          createdAt: '2026-08-12T00:00:00.000Z',
        },
        studentMap,
        teacherMap,
      )
      expect(txDebit.type).toBe('expense')
      expect(txDebit.category).toBe('Tuzatish (Balans to‘g‘rilash)')
      expect(txDebit.subject).toBe('Olim Qodirov')
    })

    it('maps REVERSAL as income to student balance', () => {
      const tx = toUiTransaction(
        {
          id: 's-6',
          direction: 'CREDIT',
          accountType: 'STUDENT',
          studentId: 'student-1',
          category: 'REVERSAL',
          amountUzs: 50_000,
          comment: 'Attendance reversed',
          createdAt: '2026-08-14T00:00:00.000Z',
        },
        studentMap,
        teacherMap,
      )

      expect(tx.type).toBe('income')
      expect(tx.category).toBe('Bekor qilish (Dars qaytarildi)')
      expect(tx.subject).toBe('Olim Qodirov')
      expect(tx.comment).toBe('Davomat bekor qilindi (mablag‘ qaytarildi)')
    })
  })

  describe('accountType: CENTER', () => {
    it('maps MANUAL_INCOME correctly', () => {
      const tx = toUiTransaction({
        id: 'c-1',
        direction: 'CREDIT',
        accountType: 'CENTER',
        category: 'MANUAL_INCOME',
        amountUzs: 5_000_000,
        subject: 'Grant',
        createdAt: '2026-08-01T00:00:00.000Z',
      })

      expect(tx.type).toBe('income')
      expect(tx.category).toBe('Kirim')
      expect(tx.subject).toBe('Grant')
    })

    it('maps MANUAL_EXPENSE with custom categoryLabel correctly', () => {
      const tx = toUiTransaction({
        id: 'c-2',
        direction: 'DEBIT',
        accountType: 'CENTER',
        category: 'MANUAL_EXPENSE',
        categoryLabel: 'Kommunal to‘lovlar',
        amountUzs: 400_000,
        subject: 'Elektr energiyasi',
        createdAt: '2026-08-01T00:00:00.000Z',
      })

      expect(tx.type).toBe('expense')
      expect(tx.category).toBe('Kommunal to‘lovlar')
      expect(tx.subject).toBe('Elektr energiyasi')
    })

    it('maps MANUAL_EXPENSE without label as Boshqa xarajat', () => {
      const tx = toUiTransaction({
        id: 'c-3',
        direction: 'DEBIT',
        accountType: 'CENTER',
        category: 'MANUAL_EXPENSE',
        amountUzs: 150_000,
        createdAt: '2026-08-01T00:00:00.000Z',
      })

      expect(tx.type).toBe('expense')
      expect(tx.category).toBe('Boshqa xarajat')
    })

    it('maps STAFF_PAYOUT correctly with login extraction', () => {
      const tx = toUiTransaction({
        id: 'c-4',
        direction: 'DEBIT',
        accountType: 'CENTER',
        category: 'STAFF_PAYOUT',
        amountUzs: 3_500_000,
        comment: 'Maosh to‘lovi (admin_sher)',
        createdAt: '2026-08-05T00:00:00.000Z',
      })

      expect(tx.type).toBe('expense')
      expect(tx.category).toBe('Xodimlar ish haqi')
      expect(tx.subject).toBe('@admin_sher')
    })
  })
})

describe('formatTransactionComment', () => {
  it('formats Fixed KPI YYYY-MM to Oylik maosh / oklad (MM.YYYY)', () => {
    expect(formatTransactionComment('Fixed KPI 2026-09')).toBe('Oylik maosh / oklad (09.2026)')
    expect(formatTransactionComment('fixed kpi 2025-12')).toBe('Oylik maosh / oklad (12.2025)')
  })

  it('formats Per-student KPI YYYY-MM to O‘quvchi soni hisoblash (MM.YYYY)', () => {
    expect(formatTransactionComment('Per-student KPI 2026-09')).toBe('O‘quvchi soni hisoblash (09.2026)')
  })

  it('formats Percent KPI accrual', () => {
    expect(formatTransactionComment('Percent KPI accrual')).toBe('Foiz hisoblash')
  })

  it('formats KPI source charge reversed', () => {
    expect(formatTransactionComment('KPI source charge reversed')).toBe(
      'KPI qaytarildi (manba dars bekor qilindi)',
    )
  })

  it('formats Attendance CAME date', () => {
    expect(formatTransactionComment('Attendance CAME 2026-09-22')).toBe('Davomat: Keldi (22.09.2026)')
  })

  it('formats Attendance ABSENT date', () => {
    expect(formatTransactionComment('Attendance ABSENT 2026-09-22')).toBe('Davomat: Sababsiz (22.09.2026)')
  })

  it('formats Attendance EXCUSED date', () => {
    expect(formatTransactionComment('Attendance EXCUSED 2026-09-22')).toBe(
      'Davomat: Sababli (22.09.2026, mablag‘ qaytarildi)',
    )
    expect(formatTransactionComment('Attendance EXCUSED')).toBe('Davomat: Sababli (mablag‘ qaytarildi)')
  })

  it('returns empty string for null or undefined', () => {
    expect(formatTransactionComment(null)).toBe('')
    expect(formatTransactionComment(undefined)).toBe('')
  })

  it('passes through unmodified comments', () => {
    expect(formatTransactionComment('Oddiy izoh')).toBe('Oddiy izoh')
  })
})
