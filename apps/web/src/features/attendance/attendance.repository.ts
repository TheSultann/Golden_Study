import type {
  AttendanceBroadcastInput,
  AttendanceBroadcastResult,
  AttendanceSession,
  MonthlyAttendanceData,
} from '@golden-study/contracts';

export interface AttendanceRepository {
  get(groupId: string, date: string): Promise<AttendanceSession>;
  getMonthly(groupId: string, month: string): Promise<MonthlyAttendanceData>;
  save(session: AttendanceSession): Promise<AttendanceSession>;
  broadcast(input: AttendanceBroadcastInput): Promise<AttendanceBroadcastResult>;
}
