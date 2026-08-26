import type {
  CourseApi,
  CourseCreateInput,
  CourseListQuery,
  CourseUpdateInput,
} from '@golden-study/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { ApiError } from '../../common/errors/api-error.js';
import { toPaginationMeta } from '../../common/http/pagination.js';

export class CourseService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async list(query: CourseListQuery) {
    const where: Prisma.CourseWhereInput = {
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const orderBy = {
      [query.sortBy]: query.sortOrder,
    } satisfies Prisma.CourseOrderByWithRelationInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { groups: true } } },
      }),
      this.prisma.course.count({ where }),
    ]);
    const data = await Promise.all(
      rows.map(async (row) =>
        this.toApi(
          row,
          (
            await this.prisma.groupStudent.findMany({
              where: { group: { courseId: row.id } },
              distinct: ['studentId'],
              select: { studentId: true },
            })
          ).length,
        ),
      ),
    );

    return {
      data,
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  public async get(id: string): Promise<CourseApi> {
    const row = await this.prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { groups: true } } },
    });
    if (!row) throw notFound('Course');
    const studentsCount = (
      await this.prisma.groupStudent.findMany({
        where: { group: { courseId: id } },
        distinct: ['studentId'],
        select: { studentId: true },
      })
    ).length;
    return this.toApi(row, studentsCount);
  }

  public async create(input: CourseCreateInput): Promise<CourseApi> {
    await this.assertUniqueTitle(input.title);
    const row = await this.prisma.course.create({
      data: {
        ...input,
        description: input.description || null,
      },
      include: { _count: { select: { groups: true } } },
    });
    return this.toApi(row, 0);
  }

  public async update(
    id: string,
    input: CourseUpdateInput,
  ): Promise<CourseApi> {
    await this.get(id);
    if (input.title) await this.assertUniqueTitle(input.title, id);
    const row = await this.prisma.course.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.durationMonths === undefined
          ? {}
          : { durationMonths: input.durationMonths }),
        ...(input.pricePerMonthUzs === undefined
          ? {}
          : { pricePerMonthUzs: input.pricePerMonthUzs }),
        ...(input.description === undefined
          ? {}
          : { description: input.description || null }),
      },
      include: { _count: { select: { groups: true } } },
    });
    const studentsCount = (
      await this.prisma.groupStudent.findMany({
        where: { group: { courseId: id } },
        distinct: ['studentId'],
        select: { studentId: true },
      })
    ).length;
    return this.toApi(row, studentsCount);
  }

  public async deactivate(id: string): Promise<void> {
    await this.setStatus(id, false);
  }

  public async setStatus(id: string, isActive: boolean): Promise<CourseApi> {
    await this.get(id);
    if (!isActive) {
      const activeGroups = await this.prisma.group.count({
        where: { courseId: id, status: 'ACTIVE' },
      });
      if (activeGroups > 0) {
        throw new ApiError(409, 'CONFLICT', 'Course has active groups');
      }
    }
    await this.prisma.course.update({
      where: { id },
      data: { isActive },
    });
    return this.get(id);
  }

  private async assertUniqueTitle(title: string, excludeId?: string) {
    const duplicate = await this.prisma.course.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ApiError(409, 'CONFLICT', 'Course title already exists');
    }
  }

  private toApi(
    row: {
      id: string;
      title: string;
      description: string | null;
      durationMonths: number;
      pricePerMonthUzs: number;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      _count: { groups: number };
    },
    studentsCount: number,
  ): CourseApi {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      durationMonths: row.durationMonths,
      pricePerMonthUzs: row.pricePerMonthUzs,
      isActive: row.isActive,
      groupsCount: row._count.groups,
      studentsCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function notFound(entity: string): ApiError {
  return new ApiError(404, 'NOT_FOUND', `${entity} not found`);
}
