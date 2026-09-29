import type { PaginationMeta, Student, StudentStats } from '@golden-study/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { studentRepository } from './student.dependencies'

const key = ['students'] as const

export const useStudents = () =>
  useQuery({
    queryKey: key,
    queryFn: () => studentRepository.list(),
  })

export interface UsePaginatedStudentsParams {
  page: number
  limit: number
  status?: 'active' | 'frozen' | 'graduate' | 'all'
  search?: string
}

export function usePaginatedStudents(params: UsePaginatedStudentsParams) {
  return useQuery({
    queryKey: ['students', 'paginated', params],
    queryFn: async (): Promise<{ data: Student[]; meta: PaginationMeta }> => {
      if (studentRepository.listPaginated) {
        return studentRepository.listPaginated(params)
      }
      const all = await studentRepository.list()
      const filtered = all.filter((s) => {
        const matchSearch = params.search
          ? `${s.code} ${s.firstName} ${s.lastName}`.toLowerCase().includes(params.search.toLowerCase())
          : true
        const matchStatus = !params.status || params.status === 'all' || s.status === params.status
        return matchSearch && matchStatus
      })
      const total = filtered.length
      const start = (params.page - 1) * params.limit
      const data = filtered.slice(start, start + params.limit)
      return {
        data,
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit) || 1,
        },
      }
    },
  })
}

export function useStudentStats() {
  return useQuery({
    queryKey: ['students', 'stats'],
    queryFn: async (): Promise<StudentStats> => {
      if (studentRepository.getStats) {
        return studentRepository.getStats()
      }
      const list = await studentRepository.list()
      const active = list.filter((s) => s.status === 'active').length
      const frozen = list.filter((s) => s.status === 'frozen').length
      const graduate = list.filter((s) => s.status === 'graduate').length
      return {
        active,
        frozen,
        graduate,
        all: active + frozen + graduate,
      }
    },
  })
}

export function useSaveStudent() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (v: Student) => studentRepository.save(v),
    onSuccess: async () => {
      await Promise.all([
        c.invalidateQueries({ queryKey: key }),
        c.invalidateQueries({ queryKey: ['student-profile'] }),
      ])
    },
  })
}

export function useSetStudentStatus() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Student['status'] }) =>
      studentRepository.setStatus(id, status),
    onSuccess: async () => {
      await Promise.all([
        c.invalidateQueries({ queryKey: key }),
        c.invalidateQueries({ queryKey: ['student-profile'] }),
      ])
    },
  })
}

export function useDeleteStudent() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => studentRepository.delete(id),
    onSuccess: async () => {
      await Promise.all([
        c.invalidateQueries({ queryKey: key }),
        c.invalidateQueries({ queryKey: ['student-profile'] }),
      ])
    },
  })
}

