import { createHash } from 'node:crypto';
import type {
  AttendanceApi,
  AttendanceBroadcastInput,
  AttendanceBroadcastResult,
  AttendanceBulkSaveInput,
  AttendanceListQuery,
  AttendanceUpdateInput,
  AuthUser,
} from '@golden-study/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { ApiError } from '../../common/errors/api-error.js';
import { toPaginationMeta } from '../../common/http/pagination.js';
import { calculateNextLesson } from '../groups/group-schedule.js';
import {
  buildGroupLessonBroadcastMessage,
  type NotificationPayloadData,
} from '../telegram/telegram-messages.js';
import { sendTelegramMessage } from '../telegram/telegram-sender.js';
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
    const groupLesson = await this.prisma.groupLesson.findUnique({
      where: {
        groupId_date: {
          groupId,
          date: dayStart,
        },
      },
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
      homeworkText: groupLesson?.homeworkText ?? '',
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
            status: 'UNMARKED' as const,
            rating: null,
            homeworkDone: false,
            homeworkScore: null,
            topicScore: null,
            dictionaryScore: null,
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

      await transaction.groupLesson.upsert({
        where: {
          groupId_date: {
            groupId: input.groupId,
            date: dayStart,
          },
        },
        create: {
          groupId: input.groupId,
          date: dayStart,
          homeworkText: input.homeworkText ?? '',
        },
        update: {
          homeworkText: input.homeworkText ?? '',
        },
      });

      const rows = [];
      for (const item of input.items) {
        const isCame = item.status === 'CAME';
        const specificScores = [
          item.homeworkScore,
          item.topicScore,
          item.dictionaryScore,
        ].filter((s): s is number => typeof s === 'number' && !isNaN(s));

        const homeworkScore = isCame && typeof item.homeworkScore === 'number'
          ? item.homeworkScore
          : null;
        const topicScore = isCame && typeof item.topicScore === 'number'
          ? item.topicScore
          : null;
        const dictionaryScore = isCame && typeof item.dictionaryScore === 'number'
          ? item.dictionaryScore
          : null;

        const rating = isCame
          ? (specificScores.length > 0
              ? Math.round(specificScores.reduce((sum, s) => sum + s, 0) / specificScores.length)
              : (typeof item.rating === 'number' ? item.rating : null))
          : null;

        const homeworkDone = isCame
          ? (typeof homeworkScore === 'number' ? homeworkScore > 0 : Boolean(item.homeworkDone))
          : false;

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
            rating,
            homeworkScore,
            topicScore,
            dictionaryScore,
            homeworkDone,
            comment: item.comment,
            lockedByAdmin: user.role !== 'TEACHER',
            createdByUserId: user.id,
          },
          update: {
            status: item.status,
            rating,
            homeworkScore,
            topicScore,
            dictionaryScore,
            homeworkDone,
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
        homeworkText: input.homeworkText ?? '',
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

  public async broadcastLesson(
    groupId: string,
    input: AttendanceBroadcastInput,
    user: AuthUser,
  ): Promise<AttendanceBroadcastResult> {
    const topic = (input.topic ?? '').trim();
    const homeworkText = (input.homeworkText ?? '').trim();

    if (!topic && !homeworkText) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Mavzu yoki uyga vazifa kiritilishi shart',
      );
    }

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        course: true,
        teacher: true,
        room: true,
      },
    });

    if (!group) {
      throw new ApiError(404, 'NOT_FOUND', 'Group not found');
    }

    if (user.role === 'TEACHER' && group.teacherId !== user.teacherId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }

    const { dayStart } = dateBounds(input.date);

    let combinedPlan = '';
    if (topic && homeworkText) {
      combinedPlan = `Mavzu: ${topic}\nVazifa: ${homeworkText}`;
    } else if (topic) {
      combinedPlan = `Mavzu: ${topic}`;
    } else {
      combinedPlan = homeworkText;
    }

    await this.prisma.groupLesson.upsert({
      where: { groupId_date: { groupId, date: dayStart } },
      create: { groupId, date: dayStart, homeworkText: combinedPlan },
      update: { homeworkText: combinedPlan },
    });

    const nextLessonInfo = calculateNextLesson(
      input.date,
      group.weekdays,
      group.lessonStartMinutes,
      group.room?.name,
    );

    const formattedDate = formatDateUz(dayStart);

    let groupChatSent = false;
    let studentsSentCount = 0;

    // 1. Broadcast to Telegram Group Chat (Strict Privacy Rule applied: NO student grades/status)
    if (input.sendToGroupChat && group.telegramChatId) {
      const groupMessage = buildGroupLessonBroadcastMessage({
        groupName: group.name,
        date: formattedDate,
        topic: topic || undefined,
        homeworkText: homeworkText || undefined,
        nextLesson: nextLessonInfo?.displaySummary,
      });

      try {
        await sendTelegramMessage(group.telegramChatId, groupMessage);
        groupChatSent = true;
      } catch (error) {
        console.error('[telegram] group broadcast message failed:', error);
      }
    }

    // 2. Broadcast to Individual Students/Parents (Personalized with attendance & rating)
    const memberships = await this.prisma.groupStudent.findMany({
      where: { groupId, status: 'ACTIVE' },
      include: {
        student: {
          include: {
            telegramLinks: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
    });

    const activeLinkedStudents = memberships.filter(
      (m) => m.student.telegramLinks && m.student.telegramLinks.length > 0,
    );

    if (input.sendToStudents && activeLinkedStudents.length > 0) {
      const records = await this.prisma.attendance.findMany({
        where: { groupId, date: dayStart, isReversed: false },
      });
      const attMap = new Map(records.map((r) => [r.studentId, r]));

      const broadcastSeq = Math.floor(Date.now() / 5000);

      for (const m of activeLinkedStudents) {
        const student = m.student;
        const att = attMap.get(student.id);

        const studentContent = [
          topic,
          homeworkText,
          att?.status ?? '',
          att?.rating ?? '',
          att?.homeworkScore ?? '',
          att?.topicScore ?? '',
          att?.dictionaryScore ?? '',
          att?.comment ?? '',
        ].join(':::');

        const studentContentHash = createHash('md5')
          .update(studentContent)
          .digest('hex')
          .slice(0, 8);

        const payload: NotificationPayloadData = {
          studentName: `${student.lastName} ${student.firstName}`,
          groupName: group.name,
          date: formattedDate,
          topic: topic || undefined,
          homeworkText: homeworkText || undefined,
          nextLesson: nextLessonInfo?.displaySummary,
          status: att ? att.status : undefined,
          rating: att?.rating ?? undefined,
          homeworkScore: att?.homeworkScore ?? undefined,
          topicScore: att?.topicScore ?? undefined,
          dictionaryScore: att?.dictionaryScore ?? undefined,
          comment: att?.comment || undefined,
        };

        let queuedForStudent = false;
        for (const link of student.telegramLinks) {
          if (this.notifier) {
            try {
              await this.notifier.enqueueToLink(
                link.id,
                'lesson_broadcast',
                payload,
                `lesson_broadcast:${groupId}:${student.id}:${input.date}:${link.id}:${studentContentHash}:${broadcastSeq}`,
              );
              queuedForStudent = true;
            } catch (err) {
              console.error('[telegram] student lesson broadcast failed:', err);
            }
          }
        }
        if (queuedForStudent) {
          studentsSentCount++;
        }
      }
    }

    const totalActiveStudents = memberships.length;
    const telegramLinkedStudents = activeLinkedStudents.length;

    let message = '';
    if (groupChatSent && studentsSentCount > 0) {
      message = `Telegram guruhga va ${studentsSentCount} ta o‘quvchiga yuborildi`;
    } else if (groupChatSent) {
      message = 'Telegram guruhga muvaffaqiyatli yuborildi';
    } else if (studentsSentCount > 0) {
      message = `${studentsSentCount} ta o‘quvchi botiga muvaffaqiyatli yuborildi`;
    } else if (input.sendToGroupChat && !group.telegramChatId) {
      message = 'Guruh Telegram chatiga ulanmagan. Faqat o‘quvchilarga yuborildi.';
    } else {
      message = 'Hech qanday qabul qiluvchi tanlanmadi yoki topilmadi';
    }

    return {
      success: groupChatSent || studentsSentCount > 0,
      groupChatSent,
      groupChatTitle: group.telegramChatTitle ?? null,
      studentsSentCount,
      totalActiveStudents,
      telegramLinkedStudents,
      nextLessonDate: nextLessonInfo?.dateIso,
      nextLessonTime: nextLessonInfo?.timeFormatted,
      nextLessonRoom: nextLessonInfo?.roomName,
      nextLessonSummary: nextLessonInfo?.displaySummary ?? null,
      message,
    };
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
      const isCame = input.status === 'CAME';
      const specificScores = [
        input.homeworkScore,
        input.topicScore,
        input.dictionaryScore,
      ].filter((s): s is number => typeof s === 'number' && !isNaN(s));

      const homeworkScore = isCame && typeof input.homeworkScore === 'number'
        ? input.homeworkScore
        : null;
      const topicScore = isCame && typeof input.topicScore === 'number'
        ? input.topicScore
        : null;
      const dictionaryScore = isCame && typeof input.dictionaryScore === 'number'
        ? input.dictionaryScore
        : null;

      const rating = isCame
        ? (specificScores.length > 0
            ? Math.round(specificScores.reduce((sum, s) => sum + s, 0) / specificScores.length)
            : (typeof input.rating === 'number' ? input.rating : null))
        : null;

      const homeworkDone = isCame
        ? (typeof homeworkScore === 'number' ? homeworkScore > 0 : Boolean(input.homeworkDone))
        : false;

      const row = await transaction.attendance.update({
        where: { id },
        data: {
          status: input.status,
          rating,
          homeworkScore,
          topicScore,
          dictionaryScore,
          homeworkDone,
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
    homeworkScore: (row.homeworkScore !== null || row.topicScore !== null || row.dictionaryScore !== null)
      ? row.homeworkScore
      : (row.status === 'CAME' ? row.rating : null),
    topicScore: (row.homeworkScore !== null || row.topicScore !== null || row.dictionaryScore !== null)
      ? row.topicScore
      : (row.status === 'CAME' ? row.rating : null),
    dictionaryScore: (row.homeworkScore !== null || row.topicScore !== null || row.dictionaryScore !== null)
      ? row.dictionaryScore
      : (row.status === 'CAME' ? row.rating : null),
    homeworkDone: row.homeworkDone,
    comment: row.comment,
    lockedByAdmin: row.lockedByAdmin,
    isReversed: row.isReversed,
    operationKey: attendanceOperationKey(row.id),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatDateUz(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Tashkent',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}`;
}

