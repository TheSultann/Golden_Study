import type {
  AttendanceBroadcastInput,
  AttendanceBroadcastResult,
  AttendanceSession,
  TeacherAttendanceGroup,
} from '@golden-study/contracts'

export interface TeacherAttendanceRepository {
  listGroups(): Promise<TeacherAttendanceGroup[]>;
  get(groupId: string, date: string): Promise<AttendanceSession>;
  save(session: AttendanceSession): Promise<AttendanceSession>;
  broadcast(input: AttendanceBroadcastInput): Promise<AttendanceBroadcastResult>;
}
