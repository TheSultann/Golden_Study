import type {
  AuthUser,
  GroupApi,
  GroupCreateInput,
  GroupListQuery,
  GroupUpdateInput,
} from '@golden-study/contracts';
import type {
  GroupStatus,
  Prisma,
  PrismaClient,
  Weekday,
} from '@prisma/client';

import { ApiError } from '../../common/errors/api-error.js';
import { toPaginationMeta } from '../../common/http/pagination.js';
import {
  calculateGroupEndDate,
  schedulesOverlap,
} from './group-schedule.js';

const groupInclude = {
  course: { select: { title: true } },
  teacher: { select: { firstName: true, lastName: true } },
  room: { select: { name: true } },
  _count: { select: { students: { where: { status: 'ACTIVE' } } } },
} satisfies Prisma.GroupInclude;

export class GroupService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async list(query: GroupListQuery, user: AuthUser) {
    const where: Prisma.GroupWhereInput = {
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      status: query.status ? query.status : { not: 'ARCHIVED' },
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(user.role === 'TEACHER'
        ? { teacherId: user.teacherId ?? '__missing__' }
        : query.teacherId
          ? { teacherId: query.teacherId }
          : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.group.findMany({
        where,
        include: groupInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.group.count({ where }),
    ]);
    return {
      data: rows.map(toApi),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  public async get(id: string, user: AuthUser): Promise<GroupApi> {
    const row = await this.prisma.group.findUnique({
      where: { id },
      include: groupInclude,
    });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Group not found');
    if (user.role === 'TEACHER' && row.teacherId !== user.teacherId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }
    return toApi(row);
  }

  public async create(input: GroupCreateInput): Promise<GroupApi> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const dependencies = await this.getDependencies(
            transaction,
            input.courseId,
            input.teacherId,
            input.roomId ?? null,
          );
          await this.assertNoConflict(transaction, {
            teacherId: input.teacherId,
            roomId: input.roomId ?? null,
            weekdays: input.weekdays,
            lessonStartMinutes: input.lessonStartMinutes,
            lessonDurationMinutes: input.lessonDurationMinutes,
          });
          const row = await transaction.group.create({
            data: {
              ...input,
              roomId: input.roomId ?? null,
              telegramChatId: input.telegramChatId ?? null,
              telegramChatTitle: input.telegramChatTitle ?? null,
              startDate: new Date(`${input.startDate}T00:00:00.000Z`),
              endDate: new Date(
                `${calculateGroupEndDate(input.startDate, dependencies.durationMonths)}T00:00:00.000Z`,
              ),
            },
            include: groupInclude,
          });
          return toApi(row);
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      throw mapGroupError(error);
    }
  }

  public async update(id: string, input: GroupUpdateInput): Promise<GroupApi> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.group.findUnique({
            where: { id },
          });
          if (!current) {
            throw new ApiError(404, 'NOT_FOUND', 'Group not found');
          }
          const merged = {
            courseId: input.courseId ?? current.courseId,
            teacherId: input.teacherId ?? current.teacherId,
            roomId:
              input.roomId === undefined ? current.roomId : input.roomId,
            weekdays: input.weekdays ?? current.weekdays,
            lessonStartMinutes:
              input.lessonStartMinutes ?? current.lessonStartMinutes,
            lessonDurationMinutes:
              input.lessonDurationMinutes ?? current.lessonDurationMinutes,
            startDate: input.startDate ?? formatDate(current.startDate),
          };
          if (
            merged.lessonStartMinutes + merged.lessonDurationMinutes >
            1440
          ) {
            throw new ApiError(
              400,
              'VALIDATION_ERROR',
              'Lesson must end before midnight',
            );
          }
          const dependencies = await this.getDependencies(
            transaction,
            merged.courseId,
            merged.teacherId,
            merged.roomId,
          );
          await this.assertNoConflict(transaction, merged, id);
          const row = await transaction.group.update({
            where: { id },
            data: {
              ...(input.name === undefined ? {} : { name: input.name }),
              ...(input.telegramChatId === undefined ? {} : { telegramChatId: input.telegramChatId }),
              ...(input.telegramChatTitle === undefined ? {} : { telegramChatTitle: input.telegramChatTitle }),
              courseId: merged.courseId,
              teacherId: merged.teacherId,
              roomId: merged.roomId,
              weekdays: merged.weekdays,
              lessonStartMinutes: merged.lessonStartMinutes,
              lessonDurationMinutes: merged.lessonDurationMinutes,
              startDate: new Date(`${merged.startDate}T00:00:00.000Z`),
              endDate: new Date(
                `${calculateGroupEndDate(merged.startDate, dependencies.durationMonths)}T00:00:00.000Z`,
              ),
            },
            include: groupInclude,
          });
          return toApi(row);
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      throw mapGroupError(error);
    }
  }

  public async archive(id: string): Promise<void> {
    await this.setStatus(id, 'ARCHIVED');
  }

  public async unlinkTelegram(id: string): Promise<GroupApi> {
    const row = await this.prisma.group.update({
      where: { id },
      data: {
        telegramChatId: null,
        telegramChatTitle: null,
      },
      include: groupInclude,
    });
    return toApi(row);
  }

  public async setStatus(id: string, status: GroupStatus): Promise<GroupApi> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.group.findUnique({
            where: { id },
            include: groupInclude,
          });
          if (!current) {
            throw new ApiError(404, 'NOT_FOUND', 'Group not found');
          }
          if (current.status === status) return toApi(current);

          if (status === 'ACTIVE') {
            await this.getDependencies(
              transaction,
              current.courseId,
              current.teacherId,
              current.roomId,
            );
            await this.assertNoConflict(transaction, current, id);
          }

          const memberships = await transaction.groupStudent.findMany({
            where: { groupId: id, status: 'ACTIVE' },
            select: { studentId: true },
          });
          const studentIds = [
            ...new Set(memberships.map((row) => row.studentId)),
          ];

          if (status === 'COMPLETED' || status === 'ARCHIVED') {
            await transaction.groupStudent.updateMany({
              where: { groupId: id, status: 'ACTIVE' },
              data: {
                status: status === 'COMPLETED' ? 'GRADUATE' : 'REMOVED',
                leftAt: new Date(),
              },
            });
          }

          await transaction.group.update({
            where: { id },
            data: { status },
          });

          if (status === 'COMPLETED') {
            for (const studentId of studentIds) {
              const activeMemberships = await transaction.groupStudent.count({
                where: {
                  studentId,
                  status: 'ACTIVE',
                  group: { status: 'ACTIVE' },
                },
              });
              if (activeMemberships === 0) {
                await transaction.student.update({
                  where: { id: studentId },
                  data: { status: 'GRADUATE' },
                });
              }
            }
          }

          return toApi(
            await transaction.group.findUniqueOrThrow({
              where: { id },
              include: groupInclude,
            }),
          );
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      throw mapGroupError(error);
    }
  }

  private async getDependencies(
    transaction: Prisma.TransactionClient,
    courseId: string,
    teacherId: string,
    roomId: string | null,
  ) {
    const [course, teacher, room] = await Promise.all([
      transaction.course.findUnique({ where: { id: courseId } }),
      transaction.teacher.findUnique({ where: { id: teacherId } }),
      roomId
        ? transaction.room.findUnique({ where: { id: roomId } })
        : Promise.resolve(null),
    ]);
    if (!course?.isActive) {
      throw new ApiError(422, 'BUSINESS_ERROR', 'Active course required');
    }
    if (!teacher?.isActive) {
      throw new ApiError(422, 'BUSINESS_ERROR', 'Active teacher required');
    }
    if (roomId && !room?.isActive) {
      throw new ApiError(422, 'BUSINESS_ERROR', 'Active room required');
    }
    return { durationMonths: course.durationMonths };
  }

  private async assertNoConflict(
    transaction: Prisma.TransactionClient,
    schedule: {
      teacherId: string;
      roomId?: string | null;
      weekdays: readonly Weekday[];
      lessonStartMinutes: number;
      lessonDurationMinutes: number;
    },
    excludeId?: string,
  ): Promise<void> {
    const candidates = await transaction.group.findMany({
      where: {
        status: 'ACTIVE',
        ...(excludeId ? { id: { not: excludeId } } : {}),
        weekdays: { hasSome: [...schedule.weekdays] },
        OR: [
          { teacherId: schedule.teacherId },
          ...(schedule.roomId ? [{ roomId: schedule.roomId }] : []),
        ],
      },
      select: {
        teacherId: true,
        roomId: true,
        weekdays: true,
        lessonStartMinutes: true,
        lessonDurationMinutes: true,
      },
    });
    for (const candidate of candidates) {
      if (
        schedulesOverlap(
          schedule.weekdays,
          schedule.lessonStartMinutes,
          schedule.lessonDurationMinutes,
          candidate.weekdays,
          candidate.lessonStartMinutes,
          candidate.lessonDurationMinutes,
        )
      ) {
        const resource =
          candidate.teacherId === schedule.teacherId ? 'Teacher' : 'Room';
        throw new ApiError(
          409,
          'CONFLICT',
          `${resource} schedule conflict`,
        );
      }
    }
  }
}

function mapGroupError(error: unknown): Error {
  if (error instanceof ApiError) return error;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === 'P2002') {
      return new ApiError(409, 'CONFLICT', 'Group name already exists');
    }
    if (error.code === 'P2034') {
      return new ApiError(409, 'CONFLICT', 'Concurrent schedule change');
    }
  }
  return error instanceof Error ? error : new Error('Group operation failed');
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toApi(
  row: Prisma.GroupGetPayload<{ include: typeof groupInclude }>,
): GroupApi {
  return {
    id: row.id,
    name: row.name,
    courseId: row.courseId,
    courseTitle: row.course.title,
    teacherId: row.teacherId,
    teacherName: `${row.teacher.firstName} ${row.teacher.lastName}`,
    roomId: row.roomId,
    roomName: row.room?.name ?? null,
    weekdays: row.weekdays,
    lessonStartMinutes: row.lessonStartMinutes,
    lessonDurationMinutes: row.lessonDurationMinutes as 60 | 90 | 120 | 150 | 180,
    startDate: formatDate(row.startDate),
    endDate: formatDate(row.endDate ?? row.startDate),
    status: row.status,
    studentsCount: row._count.students,
    telegramChatId: row.telegramChatId ?? null,
    telegramChatTitle: row.telegramChatTitle ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
