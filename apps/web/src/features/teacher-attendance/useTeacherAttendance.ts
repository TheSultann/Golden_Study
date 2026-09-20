import type { AttendanceBroadcastInput, AttendanceSession } from '@golden-study/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teacherAttendanceRepository } from './teacherAttendance.dependencies'
export const useTeacherAttendanceGroups = () => useQuery({ queryKey: ['teacher-attendance-groups'], queryFn: () => teacherAttendanceRepository.listGroups() })
export const useTeacherAttendance = (groupId: string, date: string) => useQuery({ queryKey: ['teacher-attendance', groupId, date], queryFn: () => teacherAttendanceRepository.get(groupId, date), enabled: Boolean(groupId) })
export function useSaveTeacherAttendance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (session: AttendanceSession) => teacherAttendanceRepository.save(session),
    onSuccess: async (session) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['teacher-attendance', session.groupId, session.date] }),
        client.invalidateQueries({ queryKey: ['teacher-rating'] }),
        client.invalidateQueries({ queryKey: ['student-profile'] }),
        client.invalidateQueries({ queryKey: ['students'] }),
      ]);
    },
  });
}

export function useBroadcastTeacherAttendance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AttendanceBroadcastInput) => teacherAttendanceRepository.broadcast(input),
    onSuccess: async (_, variables) => {
      if (variables.groupId) {
        await client.invalidateQueries({ queryKey: ['teacher-attendance', variables.groupId] });
      }
    },
  });
}

