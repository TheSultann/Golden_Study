import type { FinanceOverview } from '@golden-study/contracts'

export type ReportTone = 'income' | 'expense' | 'profit' | 'loss' | 'neutral'
export type ReportSummaryItem = { label: string; value: string; tone: ReportTone }

const money = (value: number) => `${new Intl.NumberFormat('uz-UZ').format(value)} UZS`

export function createCashflowSummary(summary: FinanceOverview['summary'], transactionCount: number): ReportSummaryItem[] {
  const result = summary.profit >= 0
    ? { label: 'Sof foyda', value: money(summary.profit), tone: 'profit' as const }
    : { label: 'Zarar', value: money(Math.abs(summary.profit)), tone: 'loss' as const }

  return [
    { label: 'Kirim', value: money(summary.income), tone: 'income' },
    { label: 'Chiqim', value: money(summary.expense), tone: 'expense' },
    result,
    { label: 'Operatsiyalar', value: `${transactionCount} ta`, tone: 'neutral' },
  ]
}
