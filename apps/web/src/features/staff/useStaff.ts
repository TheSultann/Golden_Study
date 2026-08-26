import type { StaffCreateInput, StaffMember } from '@golden-study/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { staffRepository } from './staff.dependencies'

const staffKey = ['staff'] as const

export const useStaff = () => useQuery({ queryKey: staffKey, queryFn: () => staffRepository.list() })

export function useSaveStaffMember() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: StaffCreateInput | StaffMember) => 'password' in input ? staffRepository.create(input) : staffRepository.update(input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: staffKey }),
        client.invalidateQueries({ queryKey: ['teachers'] }),
        client.invalidateQueries({ queryKey: ['finance'] }),
      ])
    },
  })
}

export function useSetStaffStatus() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: StaffMember['status'] }) => staffRepository.setStatus(id, status),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: staffKey }),
        client.invalidateQueries({ queryKey: ['teachers'] }),
        client.invalidateQueries({ queryKey: ['finance'] }),
      ])
    },
  })
}

export function usePayStaffSalary() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount, comment }: { id: string; amount: number; comment?: string }) =>
      staffRepository.payout(id, amount, comment),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: staffKey }),
        client.invalidateQueries({ queryKey: ['teachers'] }),
        client.invalidateQueries({ queryKey: ['finance'] }),
      ])
    },
  })
}
