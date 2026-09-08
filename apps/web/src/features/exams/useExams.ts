import type { Exam } from '@golden-study/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { examRepository } from './exam.dependencies'

const key = ['exams'] as const

export const useExams = () => useQuery({ queryKey: key, queryFn: () => examRepository.list() })

export function useSaveExam() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (exam: Exam) => examRepository.save(exam),
    onSuccess: async (saved) => {
      client.setQueryData<Exam[]>(key, (old) => {
        if (!old) return [saved]
        const index = old.findIndex((e) => e.id === saved.id)
        if (index >= 0) {
          const updated = [...old]
          updated[index] = saved
          return updated
        }
        return [saved, ...old]
      })
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ['student-profile'] }),
      ])
    },
  })
}

export function useDeleteExam() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => examRepository.delete(id),
    onSuccess: async (_, id) => {
      client.setQueryData<Exam[]>(key, (old) => (old ? old.filter((exam) => exam.id !== id) : []))
      await client.invalidateQueries({ queryKey: key })
    },
  })
}
