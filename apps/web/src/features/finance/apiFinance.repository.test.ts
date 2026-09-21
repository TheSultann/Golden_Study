import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiFinanceRepository } from './apiFinance.repository'

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
})
