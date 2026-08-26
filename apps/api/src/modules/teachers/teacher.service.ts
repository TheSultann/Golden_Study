import type {
  TeacherApi,
  TeacherCreateInput,
  TeacherListQuery,
  TeacherUpdateInput,
} from '@golden-study/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { ApiError } from '../../common/errors/api-error.js';
import { toPaginationMeta } from '../../common/http/pagination.js';
import { hashPassword } from '../auth/password.service.js';

const teacherInclude = {
  user: { select: { login: true } },
  _count: { select: { groups: { where: { status: 'ACTIVE' } } } },
  groups: {
    where: { status: 'ACTIVE' },
    select: { name: true },
  },
} satisfies Prisma.TeacherInclude;

export class TeacherService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async list(query: TeacherListQuery) {
    const where: Prisma.TeacherWhereInput = {
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.isActive === undefined ? { isActive: true } : { isActive: query.isActive }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.teacher.findMany({
        where,
        include: teacherInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.teacher.count({ where }),
    ]);
    return {
      data: rows.map(toApi),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  public async get(id: string): Promise<TeacherApi> {
    const row = await this.prisma.teacher.findUnique({
      where: { id },
      include: teacherInclude,
    });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Teacher not found');
    return toApi(row);
  }

  public async create(input: TeacherCreateInput): Promise<TeacherApi> {
    const passwordHash = await hashPassword(input.password);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const teacher = await transaction.teacher.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            ...salaryData(input),
          },
        });
        await transaction.user.create({
          data: {
            login: input.login,
            passwordHash,
            role: 'TEACHER',
            teacherId: teacher.id,
            ...(input.salaryType === 'FIXED' && input.fixedSalaryUzs
              ? { salaryUzs: input.fixedSalaryUzs }
              : {}),
          },
        });
        return toApi(
          await transaction.teacher.findUniqueOrThrow({
            where: { id: teacher.id },
            include: teacherInclude,
          }),
        );
      });
    } catch (error) {
      throw mapUniqueConflict(error);
    }
  }

  public async update(id: string, input: TeacherUpdateInput): Promise<TeacherApi> {
    await this.get(id);
    const passwordHash = input.password
      ? await hashPassword(input.password)
      : undefined;
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await transaction.teacher.update({
          where: { id },
          data: {
            ...(input.firstName === undefined ? {} : { firstName: input.firstName }),
            ...(input.lastName === undefined ? {} : { lastName: input.lastName }),
            ...(input.phone === undefined ? {} : { phone: input.phone }),
            ...(input.salaryType === undefined
              ? {}
              : salaryData({
                  salaryType: input.salaryType,
                  fixedSalaryUzs: input.fixedSalaryUzs,
                  perStudentRateUzs: input.perStudentRateUzs,
                  kpiRateBasisPoints: input.kpiRateBasisPoints,
                })),
          },
        });
        const userUpdate: Record<string, unknown> = {};
        if (input.login !== undefined) userUpdate.login = input.login;
        if (passwordHash !== undefined) userUpdate.passwordHash = passwordHash;
        if (input.salaryType !== undefined) {
          userUpdate.salaryUzs =
            input.salaryType === 'FIXED' ? (input.fixedSalaryUzs ?? null) : null;
        }
        if (Object.keys(userUpdate).length > 0) {
          await transaction.user.update({
            where: { teacherId: id },
            data: userUpdate,
          });
        }
        return toApi(
          await transaction.teacher.findUniqueOrThrow({
            where: { id },
            include: teacherInclude,
          }),
        );
      });
    } catch (error) {
      throw mapUniqueConflict(error);
    }
  }

  public async deactivate(id: string): Promise<void> {
    await this.get(id);
    if (
      (await this.prisma.group.count({
        where: { teacherId: id, status: 'ACTIVE' },
      })) > 0
    ) {
      throw new ApiError(409, 'CONFLICT', 'Teacher has active groups');
    }
    const user = await this.prisma.user.findFirst({ where: { teacherId: id } });
    const archPos = user?.position
      ? user.position.startsWith('[ARCHIVED]')
        ? user.position
        : `[ARCHIVED]${user.position}`
      : '[ARCHIVED]';
    await this.prisma.$transaction([
      this.prisma.teacher.update({
        where: { id },
        data: { isActive: false },
      }),
      this.prisma.user.updateMany({
        where: { teacherId: id },
        data: { isActive: false, position: archPos },
      }),
    ]);
  }
}

function salaryData(input: {
  salaryType: 'FIXED' | 'PER_STUDENT' | 'PERCENT';
  fixedSalaryUzs?: number | undefined;
  perStudentRateUzs?: number | undefined;
  kpiRateBasisPoints?: number | undefined;
}): {
  salaryType: 'FIXED' | 'PER_STUDENT' | 'PERCENT';
  fixedSalaryUzs: number | null;
  perStudentRateUzs: number | null;
  kpiRateBasisPoints: number | null;
} {
  return {
    salaryType: input.salaryType,
    fixedSalaryUzs: input.salaryType === 'FIXED' ? input.fixedSalaryUzs! : null,
    perStudentRateUzs:
      input.salaryType === 'PER_STUDENT' ? input.perStudentRateUzs! : null,
    kpiRateBasisPoints:
      input.salaryType === 'PERCENT' ? input.kpiRateBasisPoints! : null,
  };
}

function mapUniqueConflict(error: unknown): Error {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  ) {
    return new ApiError(409, 'CONFLICT', 'Ushbu login yoki телефон рақамига эга фойдаланувчи тизимда мавжуд');
  }
  return error instanceof Error ? error : new Error('Teacher operation failed');
}

function toApi(row: Prisma.TeacherGetPayload<{ include: typeof teacherInclude }>): TeacherApi {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    salaryType: row.salaryType,
    fixedSalaryUzs: row.fixedSalaryUzs,
    perStudentRateUzs: row.perStudentRateUzs,
    kpiRateBasisPoints: row.kpiRateBasisPoints,
    login: row.user?.login ?? null,
    isActive: row.isActive,
    groupsCount: row._count.groups,
    groups: row.groups.map((g) => g.name),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
