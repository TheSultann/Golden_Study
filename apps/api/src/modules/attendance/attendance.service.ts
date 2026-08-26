import type {
  AttendanceApi,
  AttendanceBulkSaveInput,
  AttendanceListQuery,
  AttendanceUpdateInput,
  AuthUser,
} from '@golden-study/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { ApiError } from '../../common/errors/api-error.js';
import { toPaginationMeta } from '../../common/http/pagination.js';
import { attendanceOperationKey } from './attendance-policy.js';
import type { BillingService } from '../billing/billing.service.js';
import type { TelegramNotifier } from '../telegram/telegram.service.js';

const attendanceInclude = {
  group: { select: { name: true, teacherId: true } },
  student: {
    select: { studentCode: true, firstName: true, lastName: true },
  },
} satisfies Prisma.AttendanceInclude;

export class AttendanceService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly billing?: BillingService,
    private readonly notifier?: TelegramNotifier,
  ) {}

  public async list(query: AttendanceListQuery, user: AuthUser) {
    const where = attendanceWhere(query, user);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        include: attendanceInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return {
      data: rows.map(toApi),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  public async getSession(groupId: string, date: string, user: AuthUser) {
    const group = await this.assertGroupAccess(this.prisma, groupId, user);
    const { dayStart, nextDay } = dateBounds(date);
    const memberships = await this.prisma.groupStudent.findMany({
      where: {
        groupId,
        joinedAt: { lt: nextDay },
        OR: [{ leftAt: null }, { leftAt: { gte: dayStart } }],
      },
      select: {
        student: {
          select: {
            id: true,
            studentCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });
    const records = await this.prisma.attendance.findMany({
      where: { groupId, date: dayStart },
      include: attendanceInclude,
    });
    const byStudent = new Map(
      records.map((record) => [record.studentId, toApi(record)]),
    );
    return {
      groupId,
      groupName: group.name,
      date,
      rows: memberships.map(({ student }) => {
        const saved = byStudent.get(student.id);
        return (
          saved ?? {
            id: null,
            groupId,
            groupName: group.name,
            studentId: student.id,
            studentCode: student.studentCode,
            studentName: `${student.firstName} ${student.lastName}`,
            date,
            status: 'CAME' as const,
            rating: null,
            homeworkDone: false,
            comment: '',
            lockedByAdmin: false,
            isReversed: false,
            operationKey: null,
            createdAt: null,
            updatedAt: null,
          }
        );
      }),
    };
  }

  public async save(input: AttendanceBulkSaveInput, user: AuthUser) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const group = await this.assertGroupAccess(
        transaction,
        input.groupId,
        user,
      );
      const { dayStart, nextDay } = dateBounds(input.date);
      const studentIds = input.items.map((item) => item.studentId);
      const memberships = await transaction.groupStudent.findMany({
        where: {
          groupId: input.groupId,
          studentId: { in: studentIds },
          joinedAt: { lt: nextDay },
          OR: [{ leftAt: null }, { leftAt: { gte: dayStart } }],
        },
        select: { studentId: true },
      });
      if (new Set(memberships.map((item) => item.studentId)).size !== studentIds.length) {
        throw new ApiError(
          422,
          'BUSINESS_ERROR',
          'Student membership is not active on date',
        );
      }
      const existing = await transaction.attendance.findMany({
        where: {
          groupId: input.groupId,
          date: dayStart,
          studentId: { in: studentIds },
        },
      });
      if (existing.some((record) => record.isReversed)) {
        throw new ApiError(
          422,
          'BUSINESS_ERROR',
          'Reversed attendance requires admin correction',
        );
      }
      if (
        user.role === 'TEACHER' &&
        existing.some((record) => record.lockedByAdmin)
      ) {
        throw new ApiError(403, 'FORBIDDEN', 'Attendance locked by admin');
      }
      const rows = [];
      for (const item of input.items) {
        const row = await transaction.attendance.upsert({
          where: {
            groupId_studentId_date: {
              groupId: input.groupId,
              studentId: item.studentId,
              date: dayStart,
            },
          },
          create: {
            groupId: input.groupId,
            studentId: item.studentId,
            date: dayStart,
            status: item.status,
            rating: item.rating,
            homeworkDone: item.homeworkDone,
            comment: item.comment,
            lockedByAdmin: user.role !== 'TEACHER',
            createdByUserId: user.id,
          },
          update: {
            status: item.status,
            rating: item.rating,
            homeworkDone: item.homeworkDone,
            comment: item.comment,
            ...(user.role === 'TEACHER' ? {} : { lockedByAdmin: true }),
          },
          include: attendanceInclude,
        });
        await this.billing?.reconcileAttendance(
          transaction,
          row,
          user.id,
        );
        rows.push(toApi(row));
      }
      return {
        groupId: input.groupId,
        groupName: group.name,
        date: input.date,
        rows,
      };
    });
    await this.dispatchAttendanceNotifications(result.rows);
    return result;
  }

  private async dispatchAttendanceNotifications(rows: AttendanceApi[]): Promise<void> {
    const notifier = this.notifier;
    if (!notifier) return;
    for (const row of rows) {
      const triggerType =
        row.status === 'ABSENT'
          ? 'attendance_absent'
          : !row.homeworkDone
            ? 'homework_missing'
            : null;
      if (!triggerType) continue;
      await notifier
        .notifyStudent(
          row.studentId,
          triggerType,
          { date: row.date },
          `att:${row.id}:${triggerType}`,
        )
        .catch((error) => {
          console.error('[telegram] attendance notification failed:', error);
        });
    }
  }

  public async update(
    id: string,
    input: AttendanceUpdateInput,
    actorUserId: string,
  ): Promise<AttendanceApi> {
    const current = await this.prisma.attendance.findUnique({ where: { id } });
    if (!current) {
      throw new ApiError(404, 'NOT_FOUND', 'Attendance not found');
    }
    if (current.isReversed) {
      throw new ApiError(422, 'BUSINESS_ERROR', 'Attendance is reversed');
    }
    const updated = await this.prisma.$transaction(async (transaction) => {
      const row = await transaction.attendance.update({
        where: { id },
        data: {
          status: input.status,
          rating: input.rating,
          homeworkDone: input.homeworkDone,
          comment: input.comment,
          lockedByAdmin: true,
        },
        include: attendanceInclude,
      });
      await this.billing?.reconcileAttendance(transaction, row, actorUserId);
      return toApi(row);
    });
    await this.dispatchAttendanceNotifications([updated]);
    return updated;
  }

  public async reverse(id: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.attendance.updateMany({
        where: { id, isReversed: false },
        data: {
          isReversed: true,
          reversedAt: new Date(),
          reversedByUserId: userId,
        },
      });
      if (result.count === 0) {
        const exists = await transaction.attendance.count({ where: { id } });
        throw new ApiError(
          exists ? 422 : 404,
          exists ? 'BUSINESS_ERROR' : 'NOT_FOUND',
          exists ? 'Attendance already reversed' : 'Attendance not found',
        );
      }
      await this.billing?.reverseAttendance(transaction, id, userId);
    });
  }

  public async listStudentHistory(
    studentId: string,
    query: AttendanceListQuery,
    user: AuthUser,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!student) {
      throw new ApiError(404, 'NOT_FOUND', 'Student not found');
    }
    if (user.role === 'TEACHER') {
      const visibleMembership = await this.prisma.groupStudent.count({
        where: {
          studentId,
          group: { teacherId: user.teacherId ?? '__missing__' },
        },
      });
      if (visibleMembership === 0) {
        throw new ApiError(403, 'FORBIDDEN', 'Access denied');
      }
    }
    return this.list({ ...query, studentId }, user);
  }

  private async assertGroupAccess(
    client: PrismaClient | Prisma.TransactionClient,
    groupId: string,
    user: AuthUser,
  ) {
    const group = await client.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, teacherId: true },
    });
    if (!group) throw new ApiError(404, 'NOT_FOUND', 'Group not found');
    if (user.role === 'TEACHER' && group.teacherId !== user.teacherId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }
    return group;
  }
}

function attendanceWhere(
  query: AttendanceListQuery,
  user: AuthUser,
): Prisma.AttendanceWhereInput {
  const { dayStart: dateFrom } = query.dateFrom
    ? dateBounds(query.dateFrom)
    : { dayStart: undefined };
  const { dayStart: dateTo } = query.dateTo
    ? dateBounds(query.dateTo)
    : { dayStart: undefined };
  return {
    ...(query.groupId ? { groupId: query.groupId } : {}),
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
    ...(user.role === 'TEACHER'
      ? { group: { teacherId: user.teacherId ?? '__missing__' } }
      : {}),
  };
}

function dateBounds(date: string): { dayStart: Date; nextDay: Date } {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return { dayStart, nextDay };
}

function toApi(
  row: Prisma.AttendanceGetPayload<{ include: typeof attendanceInclude }>,
): AttendanceApi {
  return {
    id: row.id,
    groupId: row.groupId,
    groupName: row.group.name,
    studentId: row.studentId,
    studentCode: row.student.studentCode,
    studentName: `${row.student.firstName} ${row.student.lastName}`,
    date: row.date.toISOString().slice(0, 10),
    status: row.status,
    rating: row.rating,
    homeworkDone: row.homeworkDone,
    comment: row.comment,
    lockedByAdmin: row.lockedByAdmin,
    isReversed: row.isReversed,
    operationKey: attendanceOperationKey(row.id),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
