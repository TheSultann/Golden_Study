import type {
  LeadApi,
  LeadCreateInput,
  LeadListQuery,
  LeadUpdateInput,
  StudentApi,
} from '@golden-study/contracts';
import type { LeadStatus, Prisma, PrismaClient } from '@prisma/client';

import { ApiError } from '../../common/errors/api-error.js';
import { toPaginationMeta } from '../../common/http/pagination.js';

const leadInclude = {
  interestedCourse: { select: { title: true } },
  teacher: { select: { firstName: true, lastName: true } },
} satisfies Prisma.LeadInclude;

const convertedStudentInclude = {
  groups: {
    where: { status: 'ACTIVE' as const },
    select: { group: { select: { id: true, name: true } } },
  },
} satisfies Prisma.StudentInclude;

export class LeadService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async list(query: LeadListQuery) {
    const where: Prisma.LeadWhereInput = {
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
      status: query.status ? query.status : { not: 'ARCHIVED' },
      ...(query.interestedCourseId
        ? { interestedCourseId: query.interestedCourseId }
        : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: leadInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.lead.count({ where }),
    ]);
    return {
      data: rows.map(toLeadApi),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  public async get(id: string): Promise<LeadApi> {
    return toLeadApi(await this.findOrThrow(this.prisma, id));
  }

  public async create(input: LeadCreateInput): Promise<LeadApi> {
    await this.assertDependencies(
      this.prisma,
      input.interestedCourseId ?? null,
      input.teacherId ?? null,
    );
    return toLeadApi(
      await this.prisma.lead.create({
        data: {
          ...input,
          interestedCourseId: input.interestedCourseId ?? null,
          teacherId: input.teacherId ?? null,
        },
        include: leadInclude,
      }),
    );
  }

  public async update(id: string, input: LeadUpdateInput): Promise<LeadApi> {
    const current = await this.findOrThrow(this.prisma, id);
    if (current.status === 'CONVERTED' || current.status === 'ARCHIVED') {
      throw new ApiError(422, 'BUSINESS_ERROR', 'Lead is terminal');
    }
    await this.assertDependencies(
      this.prisma,
      input.interestedCourseId === undefined
        ? current.interestedCourseId
        : input.interestedCourseId,
      input.teacherId === undefined ? current.teacherId : input.teacherId,
    );
    return toLeadApi(
      await this.prisma.lead.update({
        where: { id },
        data: {
          ...(input.fullName === undefined ? {} : { fullName: input.fullName }),
          ...(input.phone === undefined ? {} : { phone: input.phone }),
          ...(input.comment === undefined ? {} : { comment: input.comment }),
          ...(input.interestedCourseId === undefined
            ? {}
            : { interestedCourseId: input.interestedCourseId }),
          ...(input.teacherId === undefined
            ? {}
            : { teacherId: input.teacherId }),
        },
        include: leadInclude,
      }),
    );
  }

  public async setStatus(
    id: string,
    status: Exclude<LeadStatus, 'CONVERTED' | 'ARCHIVED'>,
  ): Promise<LeadApi> {
    const current = await this.findOrThrow(this.prisma, id);
    if (current.status === 'CONVERTED' || current.status === 'ARCHIVED') {
      throw new ApiError(422, 'BUSINESS_ERROR', 'Lead is terminal');
    }
    return toLeadApi(
      await this.prisma.lead.update({
        where: { id },
        data: { status },
        include: leadInclude,
      }),
    );
  }

  public async archive(id: string): Promise<void> {
    const current = await this.findOrThrow(this.prisma, id);
    if (current.status === 'CONVERTED') {
      throw new ApiError(422, 'BUSINESS_ERROR', 'Converted lead cannot archive');
    }
    await this.prisma.lead.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  public async convert(
    id: string,
    groupId?: string,
  ): Promise<{ lead: LeadApi; student: StudentApi }> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const lead = await this.findOrThrow(transaction, id);
            if (lead.status === 'CONVERTED' || lead.convertedStudentId) {
              throw new ApiError(409, 'CONFLICT', 'Lead already converted');
            }
            if (lead.status === 'ARCHIVED') {
              throw new ApiError(422, 'BUSINESS_ERROR', 'Lead is archived');
            }
            if (groupId) {
              const group = await transaction.group.findUnique({
                where: { id: groupId },
              });
              if (!group || group.status !== 'ACTIVE') {
                throw new ApiError(
                  422,
                  'BUSINESS_ERROR',
                  'Active group required',
                );
              }
            }
            const counter = await transaction.studentCodeCounter.upsert({
              where: { id: 'singleton' },
              create: { id: 'singleton', nextValue: 102 },
              update: { nextValue: { increment: 1 } },
            });
            const { firstName, lastName } = splitFullName(lead.fullName);
            const student = await transaction.student.create({
              data: {
                studentCode: `ST${counter.nextValue - 1}`,
                firstName,
                lastName,
                phone: lead.phone,
                statusPeriods: {
                  create: {
                    status: 'ACTIVE',
                    startedAt: new Date(),
                  },
                },
                ...(groupId
                  ? { groups: { create: { groupId } } }
                  : {}),
              },
              include: convertedStudentInclude,
            });
            const updatedLead = await transaction.lead.update({
              where: { id },
              data: {
                status: 'CONVERTED',
                convertedStudentId: student.id,
              },
              include: leadInclude,
            });
            return {
              lead: toLeadApi(updatedLead),
              student: toStudentApi(student),
            };
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        if (isPrismaCode(error, 'P2034') && attempt < 4) continue;
        throw mapLeadError(error);
      }
    }
    throw new ApiError(409, 'CONFLICT', 'Lead conversion conflict');
  }

  private async findOrThrow(
    client: PrismaClient | Prisma.TransactionClient,
    id: string,
  ) {
    const row = await client.lead.findUnique({
      where: { id },
      include: leadInclude,
    });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Lead not found');
    return row;
  }

  private async assertDependencies(
    client: PrismaClient | Prisma.TransactionClient,
    courseId: string | null,
    teacherId: string | null,
  ): Promise<void> {
    const [course, teacher] = await Promise.all([
      courseId
        ? client.course.findUnique({ where: { id: courseId } })
        : Promise.resolve(null),
      teacherId
        ? client.teacher.findUnique({ where: { id: teacherId } })
        : Promise.resolve(null),
    ]);
    if (courseId && !course?.isActive) {
      throw new ApiError(422, 'BUSINESS_ERROR', 'Active course required');
    }
    if (teacherId && !teacher?.isActive) {
      throw new ApiError(422, 'BUSINESS_ERROR', 'Active teacher required');
    }
  }
}

function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts.pop()! : '-';
  return { firstName: parts.join(' '), lastName };
}

function isPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function mapLeadError(error: unknown): Error {
  if (error instanceof ApiError) return error;
  if (isPrismaCode(error, 'P2002') || isPrismaCode(error, 'P2034')) {
    return new ApiError(409, 'CONFLICT', 'Lead conversion conflict');
  }
  return error instanceof Error ? error : new Error('Lead operation failed');
}

function toLeadApi(
  row: Prisma.LeadGetPayload<{ include: typeof leadInclude }>,
): LeadApi {
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    interestedCourseId: row.interestedCourseId,
    interestedCourseTitle: row.interestedCourse?.title ?? null,
    teacherId: row.teacherId,
    teacherName: row.teacher
      ? `${row.teacher.firstName} ${row.teacher.lastName}`
      : null,
    status: row.status,
    comment: row.comment,
    convertedStudentId: row.convertedStudentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toStudentApi(
  row: Prisma.StudentGetPayload<{
    include: typeof convertedStudentInclude;
  }>,
): StudentApi {
  return {
    id: row.id,
    studentCode: row.studentCode,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: row.birthDate?.toISOString().slice(0, 10) ?? null,
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
