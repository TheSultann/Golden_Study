import { describe, expect, it } from 'vitest'
import { createCashflowSummary } from './features/reports/reportSummary'

describe('createCashflowSummary', () => {
  it('shows a positive result as profit', () => {
    const summary = createCashflowSummary({
      income: 7_000_000,
      expense: 5_000_000,
      profit: 2_000_000,
      debt: 0,
      salaryDebt: 0,
    }, 12)

    expect(summary[2]).toMatchObject({
      label: 'Sof foyda',
      tone: 'profit',
    })
  })

  it('shows a negative result as loss with an absolute amount', () => {
    const summary = createCashflowSummary({
      income: 5_000_000,
      expense: 7_000_000,
      profit: -2_000_000,
      debt: 0,
      salaryDebt: 0,
    }, 12)

    expect(summary[2]).toMatchObject({
      label: 'Zarar',
      tone: 'loss',
    })
    expect(summary[2]?.value.replaceAll('\u00a0', ' ')).toBe('2 000 000 UZS')
  })
})
