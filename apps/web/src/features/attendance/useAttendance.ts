import type {
  AttendanceBroadcastInput,
  AttendanceSession,
  MonthlyAttendanceData,
} from '@golden-study/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceRepository } from './attendance.dependencies';

export const useAttendance = (groupId: string, date: string) =>
  useQuery({
    queryKey: ['attendance', groupId, date],
    queryFn: () => attendanceRepository.get(groupId, date),
  });

export const useMonthlyAttendance = (groupId: string, month: string) =>
  useQuery<MonthlyAttendanceData>({
    queryKey: ['attendance-monthly', groupId, month],
    queryFn: () => {
      if (typeof attendanceRepository.getMonthly !== 'function') {
        const fallback: MonthlyAttendanceData = {
          groupId,
          groupName: '',
          month,
          daysInMonth: 30,
          lessonDates: [],
          days: [],
          students: [],
          stats: {
            totalStudents: 0,
            totalLessons: 0,
            averageAttendancePercentage: 0,
          },
        };
        return Promise.resolve(fallback);
      }
      return attendanceRepository.getMonthly(groupId, month);
    },
    enabled: Boolean(groupId && month),
  });

export function useSaveAttendance() {
  const c = useQueryClient();
  return useMutation({
    mutationFn: (v: AttendanceSession) => attendanceRepository.save(v),
    onSuccess: async (v) => {
      await Promise.all([
        c.invalidateQueries({ queryKey: ['attendance', v.groupId] }),
        c.invalidateQueries({ queryKey: ['attendance-monthly', v.groupId] }),
        c.invalidateQueries({ queryKey: ['student-profile'] }),
        c.invalidateQueries({ queryKey: ['students'] }),
        c.invalidateQueries({ queryKey: ['rating'] }),
      ]);
    },
  });
}

export function useBroadcastAttendance() {
  const c = useQueryClient();
  return useMutation({
    mutationFn: (input: AttendanceBroadcastInput) => attendanceRepository.broadcast(input),
    onSuccess: async (_, variables) => {
      if (variables.groupId) {
        await c.invalidateQueries({ queryKey: ['attendance', variables.groupId] });
      }
    },
  });
}
