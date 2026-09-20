import type { Group } from '@golden-study/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { groupRepository } from './group.dependencies'

const key = ['groups'] as const

export const useGroups = () =>
  useQuery({
    queryKey: key,
    queryFn: () => groupRepository.list(),
  })

export function useSaveGroup() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (group: Group) => groupRepository.save(group),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  })
}

export function useSetGroupActive() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      groupRepository.setActive(id, active),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  })
}

export function useUnlinkGroupTelegram() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => groupRepository.unlinkTelegram(id),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  })
}


