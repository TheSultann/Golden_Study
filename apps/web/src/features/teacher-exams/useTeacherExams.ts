import type { Exam } from '@golden-study/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teacherExamsRepository } from './teacherExams.dependencies'
const key = ['teacher-exams'] as const
export const useTeacherExams = () => useQuery({ queryKey: key, queryFn: () => teacherExamsRepository.list() })
export const useTeacherExamGroups = () => useQuery({ queryKey: ['teacher-exam-groups'], queryFn: () => teacherExamsRepository.listGroups() })
export function useSaveTeacherExam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (exam: Exam) => teacherExamsRepository.save(exam),
    onSuccess: async (saved) => {
      client.setQueryData<Exam[]>(key, (old) => {
        if (!old) return [saved];
        const index = old.findIndex((e) => e.id === saved.id);
        if (index >= 0) {
          const updated = [...old];
          updated[index] = saved;
          return updated;
        }
        return [saved, ...old];
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ['student-profile'] }),
      ]);
    },
  });
}

export function useDeleteTeacherExam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teacherExamsRepository.delete(id),
    onSuccess: async (_, id) => {
      client.setQueryData<Exam[]>(key, (old) => (old ? old.filter((exam) => exam.id !== id) : []));
      await client.invalidateQueries({ queryKey: key });
    },
  });
}
