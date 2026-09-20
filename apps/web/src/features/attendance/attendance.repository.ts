import type {
  AttendanceBroadcastInput,
  AttendanceBroadcastResult,
  AttendanceSession,
} from '@golden-study/contracts';

export interface AttendanceRepository {
  get(groupId: string, date: string): Promise<AttendanceSession>;
  save(session: AttendanceSession): Promise<AttendanceSession>;
  broadcast(input: AttendanceBroadcastInput): Promise<AttendanceBroadcastResult>;
}
