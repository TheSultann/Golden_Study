import type { Lead, LeadStatus } from '@golden-study/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { leadRepository } from './lead.dependencies'

const key = ['leads'] as const

export const useLeads = () =>
  useQuery({
    queryKey: key,
    queryFn: () => leadRepository.list(),
  })

export function useSaveLead() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (v: Lead) =>
      leadRepository.save(v.id.startsWith('new-') ? { ...v, id: `l-${Date.now()}` } : v),
    onSuccess: async () => c.invalidateQueries({ queryKey: key }),
  })
}

export function useMoveLead() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      leadRepository.move(id, status),
    onSuccess: async () => c.invalidateQueries({ queryKey: key }),
  })
}

export function useArchiveLead() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => leadRepository.archive(id),
    onSuccess: async () => c.invalidateQueries({ queryKey: key }),
  })
}
