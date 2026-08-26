import type { AttendanceStatus } from '@prisma/client';

export function attendanceOperationKey(attendanceId: string): string {
  return `attendance:${attendanceId}:charge:v1`;
}

export function shouldChargeAttendance(status: AttendanceStatus): boolean {
  return status === 'CAME' || status === 'ABSENT';
}

export function isMembershipActiveOnDate(
  joinedAt: Date,
  leftAt: Date | null,
  date: string,
): boolean {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return joinedAt < nextDay && (leftAt === null || leftAt >= dayStart);
}
