import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { teacherRepository } from './teacher.dependencies'
import type { Teacher } from './teacher.types'

const teachersKey = ['teachers'] as const

export function useTeachers() {
  return useQuery({ queryKey: teachersKey, queryFn: () => teacherRepository.list() })
}

export function useSaveTeacher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (teacher: Teacher) => teacher.id.startsWith('new-') ? teacherRepository.create({ ...teacher, id: `t-${Date.now()}` }) : teacherRepository.update(teacher),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teachersKey }),
        queryClient.invalidateQueries({ queryKey: ['staff'] }),
        queryClient.invalidateQueries({ queryKey: ['finance'] }),
      ])
    },
  })
}

export function useSetTeacherActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => teacherRepository.setActive(id, active),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teachersKey }),
        queryClient.invalidateQueries({ queryKey: ['staff'] }),
        queryClient.invalidateQueries({ queryKey: ['finance'] }),
      ])
    },
  })
}
