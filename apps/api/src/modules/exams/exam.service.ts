import type { Exam, ExamSaveInput } from '@golden-study/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { ApiError } from '../../common/errors/api-error.js';
import type { AuthUser } from '@golden-study/contracts';
import type { TelegramNotifier } from '../telegram/telegram.service.js';

const examInclude = {
  group: { select: { name: true, teacherId: true } },
  results: {
    include: {
      student: {
        select: { studentCode: true, firstName: true, lastName: true },
      },
    },
  },
} satisfies Prisma.ExamInclude;

export class ExamService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly notifier?: TelegramNotifier,
  ) {}

  public async list(user: AuthUser): Promise<Exam[]> {
    const exams = await this.prisma.exam.findMany({
      where: examScope(user),
      include: examInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    return exams.map(toApi);
  }

  public async save(id: string, input: ExamSaveInput, user: AuthUser): Promise<Exam> {
    await this.assertGroupAccess(input.groupId, user);

    const dateValue = new Date(`${input.date}T00:00:00.000Z`);
    if (Number.isNaN(dateValue.getTime())) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid exam date');
    }

    const existing = await this.prisma.exam.findUnique({ where: { id } });
    if (existing) {
      await this.assertGroupAccess(existing.groupId, user);
    }

    const saved = await this.prisma.$transaction(async (transaction) => {
      const exam = existing
        ? await transaction.exam.update({
            where: { id: existing.id },
            data: {
              groupId: input.groupId,
              name: input.name,
              date: dateValue,
              maxScore: input.maxScore,
            },
          })
        : await transaction.exam.create({
            data: {
              id,
              groupId: input.groupId,
              name: input.name,
              date: dateValue,
              maxScore: input.maxScore,
              createdByUserId: user.id,
            },
          });

      for (const result of input.results) {
        const membership = await transaction.groupStudent.findFirst({
          where: { groupId: input.groupId, studentId: result.studentId },
          select: { id: true },
        });
        if (!membership) {
          throw new ApiError(
            422,
            'BUSINESS_ERROR',
            'Exam result student is not a member of the group',
          );
        }
        await transaction.examResult.upsert({
          where: {
            examId_studentId: { examId: exam.id, studentId: result.studentId },
          },
          create: {
            examId: exam.id,
            studentId: result.studentId,
            score: result.score,
            comment: result.comment ?? '',
            rank: result.rank,
          },
          update: {
            score: result.score,
            comment: result.comment ?? '',
            rank: result.rank,
          },
        });
      }

      return transaction.exam.findUniqueOrThrow({
        where: { id: exam.id },
        include: examInclude,
      });
    });

    await this.dispatchExamNotifications(saved.id);
    return toApi(saved);
  }

  public async delete(id: string, user: AuthUser): Promise<void> {
    const existing = await this.prisma.exam.findUnique({
      where: { id },
      select: { groupId: true },
    });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Exam not found');
    }
    await this.assertGroupAccess(existing.groupId, user);
    await this.prisma.exam.delete({ where: { id } });
  }

  private async dispatchExamNotifications(examId: string): Promise<void> {
    const notifier = this.notifier;
    if (!notifier) return;
    const results = await this.prisma.examResult.findMany({
      where: { examId, score: { gt: 0 } },
      select: {
        studentId: true,
        score: true,
        exam: { select: { name: true, maxScore: true } },
      },
    });
    for (const result of results) {
      await notifier
        .notifyStudent(
          result.studentId,
          'exam_result',
          {
            examName: result.exam.name,
            score: result.score,
            maxScore: result.exam.maxScore,
          },
          `exam-result:${examId}:${result.studentId}`,
        )
        .catch((error) => {
          console.error('[telegram] exam notification failed:', error);
        });
    }
  }

  private async assertGroupAccess(groupId: string, user: AuthUser): Promise<void> {
    if (user.role !== 'TEACHER') return;
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, teacherId: user.teacherId ?? '__missing__' },
      select: { id: true },
    });
    if (!group) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }
  }
}

function examScope(user: AuthUser): Prisma.ExamWhereInput {
  if (user.role === 'TEACHER') {
    return { group: { teacherId: user.teacherId ?? '__missing__' } };
  }
  return {};
}

type ExamWithRelations = Prisma.ExamGetPayload<{ include: typeof examInclude }>;

function toApi(row: ExamWithRelations): Exam {
  return {
    id: row.id,
    groupId: row.groupId,
    groupName: row.group.name,
    name: row.name,
    date: row.date.toISOString().slice(0, 10),
    maxScore: row.maxScore,
    results: row.results
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((result) => ({
        studentId: result.studentId,
        studentCode: result.student.studentCode,
        studentName: `${result.student.firstName} ${result.student.lastName}`,
        score: result.score,
        comment: result.comment,
        rank: result.rank,
      })),
  };
}
