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

export function useGroupStudents(groupId: string) {
  return useQuery({
    queryKey: ['group-students', groupId],
    queryFn: () => groupRepository.listStudents(groupId),
    enabled: Boolean(groupId),
  })
}

export function useAddGroupStudent() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, studentId }: { groupId: string; studentId: string }) =>
      groupRepository.addStudent(groupId, studentId),
    onSuccess: async (_, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['group-students', variables.groupId] }),
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ['students'] }),
        client.invalidateQueries({ queryKey: ['attendance'] }),
        client.invalidateQueries({ queryKey: ['attendance-monthly'] }),
      ])
    },
  })
}

export function useRemoveGroupStudent() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, studentId }: { groupId: string; studentId: string }) =>
      groupRepository.removeStudent(groupId, studentId),
    onSuccess: async (_, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['group-students', variables.groupId] }),
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ['students'] }),
        client.invalidateQueries({ queryKey: ['attendance'] }),
        client.invalidateQueries({ queryKey: ['attendance-monthly'] }),
      ])
    },
  })
}


