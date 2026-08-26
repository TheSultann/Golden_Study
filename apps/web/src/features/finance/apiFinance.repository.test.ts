import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiFinanceRepository } from './apiFinance.repository'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const mockSummaryApi = {
  totalIncomeUzs: 10_000_000,
  totalExpenseUzs: 2_000_000,
  totalPendingSalaryUzs: 3_000_000,
  netProfitUzs: 8_000_000,
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
    expect(result.summary.profit).toBe(8_000_000)
    expect(result.transactions.length).toBe(1)

    expect(result.transactions[0].type).toBe('income')
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
})
