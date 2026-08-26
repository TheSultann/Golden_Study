import { Prisma, type Weekday } from '@prisma/client';

const weekdayIndex: Record<Weekday, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

export function countScheduledLessons(
  yearMonth: string,
  weekdays: readonly Weekday[],
  groupStartDate: string,
  groupEndDate: string | null,
): number {
  const [year, month] = yearMonth.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year!, month! - 1, 1));
  const monthEnd = new Date(Date.UTC(year!, month, 0));
  const groupStart = new Date(`${groupStartDate}T00:00:00.000Z`);
  const groupEnd = groupEndDate
    ? new Date(`${groupEndDate}T00:00:00.000Z`)
    : monthEnd;
  const start = groupStart > monthStart ? groupStart : monthStart;
  const end = groupEnd < monthEnd ? groupEnd : monthEnd;
  if (start > end) return 0;
  const allowedDays = new Set(weekdays.map((day) => weekdayIndex[day]));
  let count = 0;
  for (
    const date = new Date(start);
    date <= end;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    if (allowedDays.has(date.getUTCDay())) count += 1;
  }
  return count;
}

export function countActiveScheduledLessons(
  yearMonth: string,
  weekdays: readonly Weekday[],
  groupStartDate: string,
  groupEndDate: string | null,
  joinedAt: Date,
  leftAt: Date | null,
  statusPeriods: ReadonlyArray<{
    status: 'ACTIVE' | 'FROZEN' | 'GRADUATE' | 'ARCHIVED';
    startedAt: Date;
    endedAt: Date | null;
  }>,
): number {
  const [year, month] = yearMonth.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year!, month! - 1, 1));
  const monthEnd = new Date(Date.UTC(year!, month, 0));
  const groupStart = new Date(`${groupStartDate}T00:00:00.000Z`);
  const groupEnd = groupEndDate
    ? new Date(`${groupEndDate}T00:00:00.000Z`)
    : monthEnd;
  const start = groupStart > monthStart ? groupStart : monthStart;
  const end = groupEnd < monthEnd ? groupEnd : monthEnd;
  const allowedDays = new Set(weekdays.map((day) => weekdayIndex[day]));
  let count = 0;
  for (
    const date = new Date(start);
    date <= end;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const nextDay = new Date(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const membershipActive =
      joinedAt < nextDay && (leftAt === null || leftAt >= date);
    const statusActive = statusPeriods.some(
      (period) =>
        period.status === 'ACTIVE' &&
        period.startedAt < nextDay &&
        (period.endedAt === null || period.endedAt >= date),
    );
    if (
      allowedDays.has(date.getUTCDay()) &&
      membershipActive &&
      statusActive
    ) {
      count += 1;
    }
  }
  return count;
}

export function calculateDailyLessonPrice(
  pricePerMonthUzs: number,
  scheduledLessons: number,
): number {
  if (scheduledLessons <= 0) {
    throw new Error('Scheduled lessons must be positive');
  }
  return Math.round(pricePerMonthUzs / scheduledLessons);
}

export function calculateMonthlyCharge(
  pricePerMonthUzs: number,
  activeLessons: number,
  totalLessons: number,
): number {
  if (totalLessons <= 0) {
    throw new Error('Scheduled lessons must be positive');
  }
  if (activeLessons < 0 || activeLessons > totalLessons) {
    throw new Error('Active lessons must be between zero and total lessons');
  }
  return Math.round((pricePerMonthUzs * activeLessons) / totalLessons);
}

export function calculatePercentKpi(
  amountUzs: number,
  basisPoints: number,
): number {
  return new Prisma.Decimal(amountUzs)
    .mul(basisPoints)
    .div(10_000)
    .round()
    .toNumber();
}

export function paymentOperationKey(idempotencyKey: string): string {
  return `payment:${idempotencyKey}`;
}

export function monthlyChargeOperationKey(
  yearMonth: string,
  groupId: string,
  studentId: string,
): string {
  return `monthly:${yearMonth}:group:${groupId}:student:${studentId}:charge:v1`;
}
