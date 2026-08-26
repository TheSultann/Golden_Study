import type {
  AuthUser,
  MembershipApi,
  StudentApi,
  StudentCreateInput,
  StudentListQuery,
  StudentUpdateInput,
} from '@golden-study/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { ApiError } from '../../common/errors/api-error.js';
import { toPaginationMeta } from '../../common/http/pagination.js';

const studentInclude = {
  groups: {
    where: { status: 'ACTIVE' as const },
    select: { group: { select: { id: true, name: true } } },
  },
} satisfies Prisma.StudentInclude;

export class StudentService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async list(query: StudentListQuery, user: AuthUser) {
    const where: Prisma.StudentWhereInput = {
      ...(query.search
        ? {
            OR: [
              { studentCode: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
      status: query.status ? query.status : { not: 'ARCHIVED' },
      ...(query.groupId
        ? { groups: { some: { groupId: query.groupId, status: 'ACTIVE' } } }
        : {}),
      ...(user.role === 'TEACHER'
        ? {
            groups: {
              some: { group: { teacherId: user.teacherId ?? '__missing__' } },
            },
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        include: studentInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.student.count({ where }),
    ]);
    return {
      data: rows.map(toStudentApi),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  public async get(id: string, user: AuthUser): Promise<StudentApi> {
    const row = await this.prisma.student.findUnique({
      where: { id },
      include: {
        ...studentInclude,
        ...(user.role === 'TEACHER'
          ? {
              groups: {
                where: {
                  group: { teacherId: user.teacherId ?? '__missing__' },
                },
                select: { group: { select: { id: true, name: true } } },
              },
            }
          : {}),
      },
    });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Student not found');
    if (user.role === 'TEACHER' && row.groups.length === 0) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }
    return toStudentApi(row);
  }

  public async create(input: StudentCreateInput): Promise<StudentApi> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const counter = await transaction.studentCodeCounter.upsert({
              where: { id: 'singleton' },
              create: { id: 'singleton', nextValue: 102 },
              update: { nextValue: { increment: 1 } },
            });
            const codeNumber = counter.nextValue - 1;
            const createdAt = new Date();
            const row = await transaction.student.create({
              data: {
                ...nullableStudentData(input),
                firstName: input.firstName,
                lastName: input.lastName,
                studentCode: `ST${codeNumber}`,
                createdAt,
                statusPeriods: {
                  create: {
                    status: 'ACTIVE',
                    startedAt: createdAt,
                  },
                },
              },
              include: studentInclude,
            });
            return toStudentApi(row);
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        if (isPrismaCode(error, 'P2034') && attempt < 4) continue;
        throw error;
      }
    }
    throw new ApiError(409, 'CONFLICT', 'Student code allocation conflict');
  }

  public async update(
    id: string,
    input: StudentUpdateInput,
  ): Promise<StudentApi> {
    await this.assertExists(id);
    const row = await this.prisma.student.update({
      where: { id },
      data: {
        ...(input.firstName === undefined ? {} : { firstName: input.firstName }),
        ...(input.lastName === undefined ? {} : { lastName: input.lastName }),
        ...nullableStudentData(input),
      },
      include: studentInclude,
    });
    return toStudentApi(row);
  }

  public async setFrozen(id: string, frozen: boolean): Promise<StudentApi> {
    return this.prisma.$transaction(async (transaction) => {
      const student = await transaction.student.findUnique({ where: { id } });
      if (!student) {
        throw new ApiError(404, 'NOT_FOUND', 'Student not found');
      }
      const expected = frozen ? 'ACTIVE' : 'FROZEN';
      if (student.status !== expected) {
        throw new ApiError(422, 'BUSINESS_ERROR', `Student must be ${expected}`);
      }
      await transitionStudentStatus(
        transaction,
        student,
        frozen ? 'FROZEN' : 'ACTIVE',
      );
      return toStudentApi(await transaction.student.findUniqueOrThrow({
        where: { id },
        include: studentInclude,
      }));
    });
  }

  public async archive(id: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const student = await transaction.student.findUnique({ where: { id } });
      if (!student) {
        throw new ApiError(404, 'NOT_FOUND', 'Student not found');
      }
      if (student.status === 'ARCHIVED') {
        throw new ApiError(422, 'BUSINESS_ERROR', 'Student already archived');
      }
      const transitionedAt = await transitionStudentStatus(
        transaction,
        student,
        'ARCHIVED',
      );
      await transaction.groupStudent.updateMany({
        where: { studentId: id, status: 'ACTIVE' },
        data: { status: 'REMOVED', leftAt: transitionedAt },
      });
    });
  }

  public async getProfile(id: string, user: AuthUser) {
    const student = await this.get(id, user);
    const attendanceRows = await this.prisma.attendance.findMany({
      where: { studentId: id, isReversed: false },
    });
    let cameCount = 0;
    let hwCount = 0;
    for (const a of attendanceRows) {
      if (a.status === 'CAME') cameCount++;
      if (a.homeworkDone) hwCount++;
    }
    const totalAtt = attendanceRows.length;
    const attendancePercent = totalAtt > 0 ? Math.round((cameCount / totalAtt) * 100) : null;
    const homeworkPercent = totalAtt > 0 ? Math.round((hwCount / totalAtt) * 100) : null;

    return {
      student,
      academicSummary: {
        ratingScore: attendancePercent,
        groupPlace: 1,
        examAveragePercent: null,
        attendancePercent,
        homeworkPercent,
      },
      updatedAt: new Date().toISOString(),
    };
  }

  public async listGroupStudents(
    groupId: string,
    user: AuthUser,
  ): Promise<StudentApi[]> {
    await this.assertGroupAccess(groupId, user);
    const rows = await this.prisma.student.findMany({
      where: { groups: { some: { groupId, status: 'ACTIVE' } } },
      include: studentInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return rows.map(toStudentApi);
  }

  public async addToGroup(
    groupId: string,
    studentId: string,
  ): Promise<MembershipApi> {
    try {
      const membership = await this.prisma.$transaction(async (transaction) => {
        const [group, student, duplicate] = await Promise.all([
          transaction.group.findUnique({ where: { id: groupId } }),
          transaction.student.findUnique({ where: { id: studentId } }),
          transaction.groupStudent.findFirst({
            where: { groupId, studentId, status: 'ACTIVE' },
          }),
        ]);
        if (!group || group.status !== 'ACTIVE') {
          throw new ApiError(422, 'BUSINESS_ERROR', 'Active group required');
        }
        if (!student || student.status !== 'ACTIVE') {
          throw new ApiError(422, 'BUSINESS_ERROR', 'Active student required');
        }
        if (duplicate) {
          throw new ApiError(409, 'CONFLICT', 'Active membership exists');
        }
        return transaction.groupStudent.create({
          data: { groupId, studentId },
        });
      });
      return toMembershipApi(membership);
    } catch (error) {
      if (isPrismaCode(error, 'P2002')) {
        throw new ApiError(409, 'CONFLICT', 'Active membership exists');
      }
      throw error;
    }
  }

  public async closeMembership(
    groupId: string,
    studentId: string,
    status: 'REMOVED' | 'GRADUATE',
  ): Promise<MembershipApi> {
    return this.prisma.$transaction(async (transaction) => {
      const membership = await transaction.groupStudent.findFirst({
        where: { groupId, studentId, status: 'ACTIVE' },
      });
      if (!membership) {
        throw new ApiError(404, 'NOT_FOUND', 'Active membership not found');
      }
      return toMembershipApi(
        await transaction.groupStudent.update({
          where: { id: membership.id },
          data: { status, leftAt: new Date() },
        }),
      );
    });
  }

  private async assertExists(id: string) {
    const row = await this.prisma.student.findUnique({ where: { id } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Student not found');
    return row;
  }

  private async assertGroupAccess(groupId: string, user: AuthUser) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new ApiError(404, 'NOT_FOUND', 'Group not found');
    if (user.role === 'TEACHER' && group.teacherId !== user.teacherId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }
  }
}

async function transitionStudentStatus(
  transaction: Prisma.TransactionClient,
  student: {
    id: string;
    status: 'ACTIVE' | 'FROZEN' | 'GRADUATE' | 'ARCHIVED';
    createdAt: Date;
  },
  nextStatus: 'ACTIVE' | 'FROZEN' | 'GRADUATE' | 'ARCHIVED',
): Promise<Date> {
  const open = await transaction.studentStatusPeriod.findFirst({
    where: { studentId: student.id, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  const base = open?.startedAt ?? student.createdAt;
  const now = new Date();
  const transitionedAt =
    now > base ? now : new Date(base.getTime() + 1);
  if (open) {
    await transaction.studentStatusPeriod.update({
      where: { id: open.id },
      data: { endedAt: transitionedAt },
    });
  } else {
    await transaction.studentStatusPeriod.create({
      data: {
        studentId: student.id,
        status: student.status,
        startedAt: student.createdAt,
        endedAt: transitionedAt,
      },
    });
  }
  await transaction.studentStatusPeriod.create({
    data: {
      studentId: student.id,
      status: nextStatus,
      startedAt: transitionedAt,
    },
  });
  await transaction.student.update({
    where: { id: student.id },
    data: { status: nextStatus },
  });
  return transitionedAt;
}

function nullableStudentData(input: {
  birthDate?: string | null | undefined;
  phone?: string | null | undefined;
  address?: string | null | undefined;
  parentName?: string | null | undefined;
  parentPhone?: string | null | undefined;
}): {
  birthDate?: Date | null;
  phone?: string | null;
  address?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
} {
  return {
    ...(input.birthDate === undefined
      ? {}
      : {
          birthDate: input.birthDate
            ? new Date(`${input.birthDate}T00:00:00.000Z`)
            : null,
        }),
    ...(input.phone === undefined ? {} : { phone: input.phone }),
    ...(input.address === undefined ? {} : { address: input.address }),
    ...(input.parentName === undefined ? {} : { parentName: input.parentName }),
    ...(input.parentPhone === undefined
      ? {}
      : { parentPhone: input.parentPhone }),
  };
}

function isPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function formatDate(date: Date | null): string | null {
  return date?.toISOString().slice(0, 10) ?? null;
}

function toStudentApi(
  row: Prisma.StudentGetPayload<{ include: typeof studentInclude }>,
): StudentApi {
  return {
    id: row.id,
    studentCode: row.studentCode,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: formatDate(row.birthDate),
    phone: row.phone,
    address: row.address,
    parentName: row.parentName,
    parentPhone: row.parentPhone,
    status: row.status,
    activeGroups: row.groups.map(({ group }) => group),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMembershipApi(row: {
  id: string;
  groupId: string;
  studentId: string;
  joinedAt: Date;
  leftAt: Date | null;
  status: 'ACTIVE' | 'GRADUATE' | 'REMOVED';
}): MembershipApi {
  return {
    ...row,
    joinedAt: row.joinedAt.toISOString(),
    leftAt: row.leftAt?.toISOString() ?? null,
  };
}
