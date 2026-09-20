import type { Weekday } from '@prisma/client';

export function calculateGroupEndDate(
  startDate: string,
  durationMonths: number,
): string {
  const [year, month, day] = startDate.split('-').map(Number);
  const targetMonthIndex = month! - 1 + durationMonths;
  const targetYear = year! + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(targetYear, targetMonth, Math.min(day!, lastDay)),
  )
    .toISOString()
    .slice(0, 10);
}

export function schedulesOverlap(
  firstWeekdays: readonly Weekday[],
  firstStart: number,
  firstDuration: number,
  secondWeekdays: readonly Weekday[],
  secondStart: number,
  secondDuration: number,
): boolean {
  const commonDay = firstWeekdays.some((day) => secondWeekdays.includes(day));
  return (
    commonDay &&
    firstStart < secondStart + secondDuration &&
    secondStart < firstStart + firstDuration
  );
}

const weekdayIndexMap: Record<Weekday, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

export interface NextLessonInfo {
  dateIso: string;
  dateFormatted: string;
  timeFormatted: string;
  roomName: string | null;
  displaySummary: string;
}

export function calculateNextLesson(
  currentDateStr: string,
  weekdays: readonly Weekday[],
  lessonStartMinutes: number,
  roomName?: string | null,
): NextLessonInfo | null {
  if (!currentDateStr || !weekdays || weekdays.length === 0) return null;

  const targetDayIndices = new Set(weekdays.map((w) => weekdayIndexMap[w]));
  const current = new Date(`${currentDateStr}T00:00:00.000Z`);
  if (isNaN(current.getTime())) return null;

  const startMinutes =
    typeof lessonStartMinutes === 'number' && !isNaN(lessonStartMinutes)
      ? Math.max(0, lessonStartMinutes)
      : 540;

  for (let offset = 1; offset <= 14; offset++) {
    const candidate = new Date(current.getTime() + offset * 24 * 60 * 60 * 1000);
    const dayOfWeek = candidate.getUTCDay();
    if (targetDayIndices.has(dayOfWeek)) {
      const year = candidate.getUTCFullYear();
      const month = String(candidate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(candidate.getUTCDate()).padStart(2, '0');
      const dateIso = `${year}-${month}-${day}`;
      const dateFormatted = `${day}.${month}.${year}`;

      const hours = Math.floor(startMinutes / 60).toString().padStart(2, '0');
      const minutes = (startMinutes % 60).toString().padStart(2, '0');
      const timeFormatted = `${hours}:${minutes}`;

      const roomText = roomName ? ` (${roomName})` : '';
      const displaySummary = `${dateFormatted}, ${timeFormatted}${roomText}`;

      return {
        dateIso,
        dateFormatted,
        timeFormatted,
        roomName: roomName ?? null,
        displaySummary,
      };
    }
  }

  return null;
}

