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
