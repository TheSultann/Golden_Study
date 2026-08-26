import type { Student } from '@golden-study/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { studentRepository } from './student.dependencies'

const key = ['students'] as const

export const useStudents = () =>
  useQuery({
    queryKey: key,
    queryFn: () => studentRepository.list(),
  })

export function useSaveStudent() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (v: Student) => studentRepository.save(v),
    onSuccess: async () => c.invalidateQueries({ queryKey: key }),
  })
}

export function useSetStudentStatus() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Student['status'] }) =>
      studentRepository.setStatus(id, status),
    onSuccess: async () => c.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteStudent() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => studentRepository.delete(id),
    onSuccess: async () => c.invalidateQueries({ queryKey: key }),
  })
}

