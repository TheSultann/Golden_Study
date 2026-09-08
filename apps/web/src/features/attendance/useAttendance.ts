import type { AttendanceSession } from '@golden-study/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceRepository } from './attendance.dependencies';

export const useAttendance = (groupId: string, date: string) =>
  useQuery({
    queryKey: ['attendance', groupId, date],
    queryFn: () => attendanceRepository.get(groupId, date),
  });

export function useSaveAttendance() {
  const c = useQueryClient();
  return useMutation({
    mutationFn: (v: AttendanceSession) => attendanceRepository.save(v),
    onSuccess: async (v) => {
      await Promise.all([
        c.invalidateQueries({ queryKey: ['attendance', v.groupId, v.date] }),
        c.invalidateQueries({ queryKey: ['student-profile'] }),
        c.invalidateQueries({ queryKey: ['students'] }),
        c.invalidateQueries({ queryKey: ['rating'] }),
      ]);
    },
  });
}
