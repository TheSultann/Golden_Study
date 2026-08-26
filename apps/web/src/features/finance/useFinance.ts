import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useStaff } from '../staff/useStaff'
import { staffRepository } from '../staff/staff.dependencies'
import { financeRepository } from './finance.dependencies'
import type { SaveExpenseInput, SaveFinanceTransactionInput, SaveStudentPaymentInput } from './finance.repository'

const key = ['finance'] as const
export const useFinance = (options?: { enabled?: boolean }) => {
  const staffQuery = useStaff()
  return useQuery({
    queryKey: [...key, staffQuery.dataUpdatedAt],
    queryFn: () => financeRepository.overview(staffQuery.data),
    enabled: (options?.enabled ?? true) && staffQuery.isSuccess,
    placeholderData: (prev: any) => prev,
  })
}
export function useSaveFinanceTransaction() { const client = useQueryClient(); return useMutation({ mutationFn: (input: SaveFinanceTransactionInput) => financeRepository.saveTransaction(input), onSuccess: async () => client.invalidateQueries({ queryKey: key }) }) }
export function useSaveStudentPayment() { const client = useQueryClient(); return useMutation({ mutationFn: (input: SaveStudentPaymentInput) => financeRepository.saveStudentPayment(input), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: key }), client.invalidateQueries({ queryKey: ['students'] }), client.invalidateQueries({ queryKey: ['student'] }), client.invalidateQueries({ queryKey: ['reports'] }), client.invalidateQueries({ queryKey: ['telegram-bot'] })]) } }) }
export function useSaveExpense() { const client = useQueryClient(); return useMutation({ mutationFn: (input: SaveExpenseInput) => financeRepository.saveExpense(input), onSuccess: async () => client.invalidateQueries({ queryKey: key }) }) }
export function usePayTeacherSalary() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: string | { id: string; recipientType?: 'STAFF' | 'TEACHER'; amount?: number; comment?: string }) => {
      if (typeof input === 'string') {
        await financeRepository.paySalary(input)
        return
      }
      if (input.recipientType === 'STAFF') {
        await staffRepository.payout(input.id, input.amount || 1_000_000, input.comment)
        return
      }
      await financeRepository.paySalary(input.id)
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ['staff'] }),
      ])
    },
  })
}
