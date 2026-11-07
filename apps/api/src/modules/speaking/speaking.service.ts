import type {
  AuthUser,
  CreateSpeakingTopicInput,
  GradeSpeakingSubmissionInput,
  GradeStudentSpeakingInput,
  QuerySpeaking,
  SpeakingSubmission,
  SpeakingTopic,
  SubmitSpeakingSubmissionInput,
} from '@golden-study/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { ApiError } from '../../common/errors/api-error.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { sendTelegramMessage } from '../telegram/telegram-sender.js';
import type { GeminiSpeakingService } from './gemini-speaking.service.js';

export class SpeakingService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly geminiService: GeminiSpeakingService,
  ) {}

  public async listTopics(groupId?: string, user?: AuthUser): Promise<SpeakingTopic[]> {
    const where: Prisma.SpeakingTopicWhereInput = {};

    if (groupId) {
      where.groupId = groupId;
    }

    if (user && user.role === 'TEACHER') {
      where.teacherId = user.teacherId ?? '__missing__';
    }

    let topics = await this.prisma.speakingTopic.findMany({
      where,
      include: {
        group: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    if (topics.length === 0 && groupId) {
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        select: { id: true, name: true, teacherId: true },
      });

      if (group && (!user || user.role !== 'TEACHER' || group.teacherId === user.teacherId)) {
        const defaultTopic = await this.prisma.speakingTopic.create({
          data: {
            groupId: group.id,
            teacherId: group.teacherId,
            title: 'Speaking amaliyoti',
            description: 'O‘quvchilarning og‘zaki nutq amaliyoti va ovozli topshiriqlari',
            maxScore: 10,
            deadline: null,
          },
          include: {
            group: { select: { name: true } },
          },
        });
        topics = [defaultTopic];
      }
    }

    return topics.map((t) => ({
      id: t.id,
      groupId: t.groupId,
      groupName: t.group.name,
      teacherId: t.teacherId,
      title: t.title,
      description: t.description,
      maxScore: t.maxScore,
      deadline: t.deadline ? t.deadline.toISOString().slice(0, 10) : null,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  public async createTopic(
    input: CreateSpeakingTopicInput,
    user: AuthUser,
  ): Promise<SpeakingTopic> {
    const group = await this.prisma.group.findUnique({
      where: { id: input.groupId },
      select: { id: true, name: true, teacherId: true },
    });

    if (!group) {
      throw new ApiError(404, 'NOT_FOUND', 'Group not found');
    }

    if (user.role === 'TEACHER' && group.teacherId !== user.teacherId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied to this group');
    }

    const teacherId = user.role === 'TEACHER' ? user.teacherId! : group.teacherId;

    let deadlineDate: Date | null = null;
    if (input.deadline) {
      deadlineDate = new Date(`${input.deadline.slice(0, 10)}T00:00:00.000Z`);
      if (Number.isNaN(deadlineDate.getTime())) {
        deadlineDate = null;
      }
    }

    const topic = await this.prisma.speakingTopic.create({
      data: {
        groupId: input.groupId,
        teacherId,
        title: input.title.trim(),
        description: input.description ?? '',
        maxScore: input.maxScore ?? 10,
        deadline: deadlineDate,
      },
      include: {
        group: { select: { name: true } },
      },
    });

    return {
      id: topic.id,
      groupId: topic.groupId,
      groupName: topic.group.name,
      teacherId: topic.teacherId,
      title: topic.title,
      description: topic.description,
      maxScore: topic.maxScore,
      deadline: topic.deadline ? topic.deadline.toISOString().slice(0, 10) : null,
      createdAt: topic.createdAt.toISOString(),
    };
  }

  public async listSubmissions(
    query: QuerySpeaking,
    user?: AuthUser,
  ): Promise<SpeakingSubmission[]> {
    const where: Prisma.SpeakingSubmissionWhereInput = {};

    if (query.topicId) {
      where.topicId = query.topicId;
    }

    if (query.studentId) {
      where.studentId = query.studentId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.groupId) {
      where.topic = { groupId: query.groupId };
    }

    if (user && user.role === 'TEACHER') {
      where.topic = {
        ...(where.topic as Prisma.SpeakingTopicWhereInput),
        teacherId: user.teacherId ?? '__missing__',
      };
    }

    const submissions = await this.prisma.speakingSubmission.findMany({
      where,
      include: {
        student: { select: { firstName: true, lastName: true, studentCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return submissions.map((sub) => ({
      id: sub.id,
      topicId: sub.topicId,
      studentId: sub.studentId,
      studentName: `${sub.student.firstName} ${sub.student.lastName}`,
      studentCode: sub.student.studentCode,
      audioUrl: sub.audioUrl,
      durationSeconds: sub.durationSeconds,
      transcript: sub.transcript,
      aiFeedback: sub.aiFeedback,
      aiScore: sub.aiScore,
      teacherScore: sub.teacherScore,
      teacherComment: sub.teacherComment,
      status: sub.status,
      createdAt: sub.createdAt.toISOString(),
    }));
  }

  public async gradeSubmission(
    id: string,
    input: GradeSpeakingSubmissionInput,
    user: AuthUser,
  ): Promise<SpeakingSubmission> {
    const existing = await this.prisma.speakingSubmission.findUnique({
      where: { id },
      include: {
        topic: { select: { title: true, teacherId: true, maxScore: true } },
        student: { select: { firstName: true, lastName: true, studentCode: true } },
      },
    });

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Speaking submission not found');
    }

    if (user.role === 'TEACHER' && existing.topic.teacherId !== user.teacherId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied to this submission');
    }

    const allowedMax = Math.max(10, existing.topic.maxScore);
    if (input.teacherScore < 0 || input.teacherScore > allowedMax) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        `Teacher score cannot exceed maximum score of ${allowedMax}`,
      );
    }

    const updated = await this.prisma.speakingSubmission.update({
      where: { id },
      data: {
        teacherScore: input.teacherScore,
        teacherComment: input.teacherComment?.trim() ?? '',
        status: 'GRADED_BY_TEACHER',
      },
      include: {
        student: { select: { firstName: true, lastName: true, studentCode: true } },
      },
    });

    // Notify student in Telegram if linked
    void this.prisma.telegramLink
      .findFirst({
        where: { studentId: updated.studentId, status: 'ACTIVE' },
        select: { telegramChatId: true },
      })
      .then((link) => {
        if (!link?.telegramChatId) return;
        const topicTitle = existing.topic?.title || 'Speaking';
        const comment = updated.teacherComment
          ? `\n💬 <b>Izoh:</b> ${updated.teacherComment}`
          : '';
        const message = `🎉 <b>Speaking topshirig‘ingiz baholandi!</b>\n\n📌 <b>Mavzu:</b> ${topicTitle}\n⭐️ <b>O‘qituvchi bahosi:</b> ${updated.teacherScore} / 10${comment}`;
        return sendTelegramMessage(link.telegramChatId, message);
      })
      .catch((err) => {
        logger.error({ err }, 'Failed to send speaking grade Telegram notification');
      });

    return {
      id: updated.id,
      topicId: updated.topicId,
      studentId: updated.studentId,
      studentName: `${updated.student.firstName} ${updated.student.lastName}`,
      studentCode: updated.student.studentCode,
      audioUrl: updated.audioUrl,
      durationSeconds: updated.durationSeconds,
      transcript: updated.transcript,
      aiFeedback: updated.aiFeedback,
      aiScore: updated.aiScore,
      teacherScore: updated.teacherScore,
      teacherComment: updated.teacherComment,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  public async gradeStudent(
    input: GradeStudentSpeakingInput,
    user: AuthUser,
  ): Promise<SpeakingSubmission> {
    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, firstName: true, lastName: true, studentCode: true },
    });

    if (!student) {
      throw new ApiError(404, 'NOT_FOUND', 'Student not found');
    }

    let topicId = input.topicId;
    if (!topicId) {
      let groupId = input.groupId;
      if (!groupId) {
        const studentGroup = await this.prisma.groupStudent.findFirst({
          where: { studentId: input.studentId, status: 'ACTIVE' },
          select: { groupId: true },
        });
        groupId = studentGroup?.groupId;
      }

      if (!groupId) {
        throw new ApiError(400, 'BAD_REQUEST', 'Group ID or Topic ID is required');
      }

      let topic = await this.prisma.speakingTopic.findFirst({
        where: { groupId },
        orderBy: { createdAt: 'desc' },
      });

      if (!topic) {
        const group = await this.prisma.group.findUnique({
          where: { id: groupId },
          select: { id: true, name: true, teacherId: true },
        });
        if (!group) {
          throw new ApiError(404, 'NOT_FOUND', 'Group not found');
        }
        topic = await this.prisma.speakingTopic.create({
          data: {
            groupId: group.id,
            teacherId: group.teacherId,
            title: 'Speaking amaliyoti',
            description: 'O‘quvchilarning og‘zaki nutq amaliyoti va ovozli topshiriqlari',
            maxScore: 10,
            deadline: null,
          },
        });
      }
      topicId = topic.id;
    }

    const topic = await this.prisma.speakingTopic.findUnique({
      where: { id: topicId },
      include: { group: { select: { id: true, name: true, teacherId: true } } },
    });

    if (!topic) {
      throw new ApiError(404, 'NOT_FOUND', 'Speaking topic not found');
    }

    if (user.role === 'TEACHER' && topic.teacherId !== user.teacherId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied to this topic');
    }

    const allowedMax = Math.max(10, topic.maxScore);
    if (input.teacherScore < 0 || input.teacherScore > allowedMax) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        `Teacher score cannot exceed maximum score of ${allowedMax}`,
      );
    }

    const existing = await this.prisma.speakingSubmission.findFirst({
      where: { topicId, studentId: input.studentId },
      orderBy: { createdAt: 'desc' },
    });

    let submissionRecord;
    if (existing) {
      submissionRecord = await this.prisma.speakingSubmission.update({
        where: { id: existing.id },
        data: {
          teacherScore: input.teacherScore,
          teacherComment: input.teacherComment?.trim() ?? '',
          status: 'GRADED_BY_TEACHER',
        },
        include: {
          student: { select: { firstName: true, lastName: true, studentCode: true } },
        },
      });
    } else {
      submissionRecord = await this.prisma.speakingSubmission.create({
        data: {
          topicId,
          studentId: input.studentId,
          audioUrl: 'in-person',
          durationSeconds: 0,
          transcript: '',
          aiFeedback: '',
          aiScore: null,
          teacherScore: input.teacherScore,
          teacherComment: input.teacherComment?.trim() ?? '',
          status: 'GRADED_BY_TEACHER',
        },
        include: {
          student: { select: { firstName: true, lastName: true, studentCode: true } },
        },
      });
    }

    void this.prisma.telegramLink
      .findFirst({
        where: { studentId: input.studentId, status: 'ACTIVE' },
        select: { telegramChatId: true },
      })
      .then((link) => {
        if (!link?.telegramChatId) return;
        const topicTitle = topic.title || 'Speaking';
        const comment = submissionRecord.teacherComment
          ? `\n💬 <b>Izoh:</b> ${submissionRecord.teacherComment}`
          : '';
        const message = `🎉 <b>Speaking topshirig‘ingiz baholandi!</b>\n\n📌 <b>Mavzu:</b> ${topicTitle}\n⭐️ <b>O‘qituvchi bahosi:</b> ${submissionRecord.teacherScore} / 10${comment}`;
        return sendTelegramMessage(link.telegramChatId, message);
      })
      .catch((err) => {
        logger.error({ err }, 'Failed to send speaking grade Telegram notification');
      });

    return {
      id: submissionRecord.id,
      topicId: submissionRecord.topicId,
      studentId: submissionRecord.studentId,
      studentName: `${submissionRecord.student.firstName} ${submissionRecord.student.lastName}`,
      studentCode: submissionRecord.student.studentCode,
      audioUrl: submissionRecord.audioUrl,
      durationSeconds: submissionRecord.durationSeconds,
      transcript: submissionRecord.transcript,
      aiFeedback: submissionRecord.aiFeedback,
      aiScore: submissionRecord.aiScore,
      teacherScore: submissionRecord.teacherScore,
      teacherComment: submissionRecord.teacherComment,
      status: submissionRecord.status,
      createdAt: submissionRecord.createdAt.toISOString(),
    };
  }

  public async createSubmission(
    input: SubmitSpeakingSubmissionInput,
    user?: AuthUser,
  ): Promise<SpeakingSubmission> {
    const topic = await this.prisma.speakingTopic.findUnique({
      where: { id: input.topicId },
      include: { group: { select: { id: true, name: true, teacherId: true } } },
    });

    if (!topic) {
      throw new ApiError(404, 'NOT_FOUND', 'Speaking topic not found');
    }

    if (user && user.role === 'TEACHER' && topic.teacherId !== user.teacherId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied to this topic');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, firstName: true, lastName: true, studentCode: true },
    });

    if (!student) {
      throw new ApiError(404, 'NOT_FOUND', 'Student not found');
    }

    const membership = await this.prisma.groupStudent.findFirst({
      where: { groupId: topic.groupId, studentId: input.studentId },
      select: { id: true },
    });

    if (!membership) {
      throw new ApiError(
        422,
        'BUSINESS_ERROR',
        'Student is not a member of the topic group',
      );
    }

    let effectiveAudioUrl = input.audioUrl?.trim() || '';
    if (input.fileId?.trim()) {
      effectiveAudioUrl = `telegram:${input.fileId.trim()}`;
    } else if (effectiveAudioUrl.startsWith('data:') || effectiveAudioUrl.length > 500) {
      // 0 MB requirement: Never persist raw Base64 data in PostgreSQL
      effectiveAudioUrl = 'in-memory-audio';
    } else if (!effectiveAudioUrl) {
      effectiveAudioUrl = 'telegram-voice';
    }

    // Create initial submission
    const submission = await this.prisma.speakingSubmission.create({
      data: {
        topicId: input.topicId,
        studentId: input.studentId,
        audioUrl: effectiveAudioUrl,
        durationSeconds: input.durationSeconds ?? 0,
        status: 'PENDING_AI',
      },
    });

    // Run AI Evaluation via Gemini
    try {
      const inMemoryBase64 =
        input.audioBase64 ||
        (input.audioUrl?.startsWith('data:')
          ? input.audioUrl.split(',')[1]
          : undefined);

      const evaluation = await this.geminiService.evaluate({
        audioUrl: effectiveAudioUrl,
        audioBase64: inMemoryBase64,
        mimeType: input.mimeType,
        topicTitle: topic.title,
        topicDescription: topic.description,
      });

      if (evaluation) {
        const updated = await this.prisma.speakingSubmission.update({
          where: { id: submission.id },
          data: {
            transcript: evaluation.transcript,
            aiFeedback: evaluation.aiFeedback,
            aiScore: evaluation.aiScore,
            status: 'EVALUATED_BY_AI',
          },
          include: {
            student: { select: { firstName: true, lastName: true, studentCode: true } },
          },
        });

        return {
          id: updated.id,
          topicId: updated.topicId,
          studentId: updated.studentId,
          studentName: `${updated.student.firstName} ${updated.student.lastName}`,
          studentCode: updated.student.studentCode,
          audioUrl: updated.audioUrl,
          durationSeconds: updated.durationSeconds,
          transcript: updated.transcript,
          aiFeedback: updated.aiFeedback,
          aiScore: updated.aiScore,
          teacherScore: updated.teacherScore,
          teacherComment: updated.teacherComment,
          status: updated.status,
          createdAt: updated.createdAt.toISOString(),
        };
      }
    } catch (aiErr) {
      logger.warn({ err: aiErr }, 'AI evaluation failed or skipped');
    }

    // If AI evaluation skipped/failed, audio is preserved for manual teacher review
    return {
      id: submission.id,
      topicId: submission.topicId,
      studentId: submission.studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      studentCode: student.studentCode,
      audioUrl: submission.audioUrl,
      durationSeconds: submission.durationSeconds,
      transcript: '',
      aiFeedback: '',
      aiScore: null,
      teacherScore: null,
      teacherComment: null,
      status: 'PENDING_AI',
      createdAt: submission.createdAt.toISOString(),
    };
  }

  public async evaluateSubmission(id: string): Promise<SpeakingSubmission> {
    const existing = await this.prisma.speakingSubmission.findUnique({
      where: { id },
      include: {
        topic: { select: { title: true, description: true } },
        student: { select: { firstName: true, lastName: true, studentCode: true } },
      },
    });

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Speaking submission not found');
    }

    // Idempotent: If already evaluated or graded, do not duplicate evaluation
    if (existing.status === 'EVALUATED_BY_AI' || existing.status === 'GRADED_BY_TEACHER') {
      return {
        id: existing.id,
        topicId: existing.topicId,
        studentId: existing.studentId,
        studentName: `${existing.student.firstName} ${existing.student.lastName}`,
        studentCode: existing.student.studentCode,
        audioUrl: existing.audioUrl,
        durationSeconds: existing.durationSeconds,
        transcript: existing.transcript,
        aiFeedback: existing.aiFeedback,
        aiScore: existing.aiScore,
        teacherScore: existing.teacherScore,
        teacherComment: existing.teacherComment,
        status: existing.status,
        createdAt: existing.createdAt.toISOString(),
      };
    }

    const evaluation = await this.geminiService.evaluate({
      audioUrl: existing.audioUrl,
      topicTitle: existing.topic.title,
      topicDescription: existing.topic.description,
    });

    if (evaluation) {
      const updated = await this.prisma.speakingSubmission.update({
        where: { id },
        data: {
          transcript: evaluation.transcript,
          aiFeedback: evaluation.aiFeedback,
          aiScore: evaluation.aiScore,
          status: 'EVALUATED_BY_AI',
        },
        include: {
          student: { select: { firstName: true, lastName: true, studentCode: true } },
        },
      });

      return {
        id: updated.id,
        topicId: updated.topicId,
        studentId: updated.studentId,
        studentName: `${updated.student.firstName} ${updated.student.lastName}`,
        studentCode: updated.student.studentCode,
        audioUrl: updated.audioUrl,
        durationSeconds: updated.durationSeconds,
        transcript: updated.transcript,
        aiFeedback: updated.aiFeedback,
        aiScore: updated.aiScore,
        teacherScore: updated.teacherScore,
        teacherComment: updated.teacherComment,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
      };
    }

    return {
      id: existing.id,
      topicId: existing.topicId,
      studentId: existing.studentId,
      studentName: `${existing.student.firstName} ${existing.student.lastName}`,
      studentCode: existing.student.studentCode,
      audioUrl: existing.audioUrl,
      durationSeconds: existing.durationSeconds,
      transcript: existing.transcript,
      aiFeedback: existing.aiFeedback,
      aiScore: existing.aiScore,
      teacherScore: existing.teacherScore,
      teacherComment: existing.teacherComment,
      status: existing.status,
      createdAt: existing.createdAt.toISOString(),
    };
  }

  public async getSubmissionAudio(
    id: string,
    user: AuthUser,
    rangeHeader?: string | undefined,
  ): Promise<SubmissionAudioResult> {
    const submission = await this.prisma.speakingSubmission.findUnique({
      where: { id },
      include: {
        topic: { select: { teacherId: true } },
      },
    });

    if (!submission) {
      throw new ApiError(404, 'NOT_FOUND', 'Speaking submission not found');
    }

    if (user.role === 'TEACHER' && submission.topic.teacherId !== user.teacherId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied to this submission');
    }

    const audioUrl = submission.audioUrl?.trim() || '';
    if (!audioUrl || audioUrl === 'telegram-voice' || audioUrl === 'in-memory-audio') {
      throw new ApiError(404, 'NOT_FOUND', 'Audio recording not found');
    }

    // 1. Data URI fallback (legacy backwards compatibility)
    if (audioUrl.startsWith('data:')) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(audioUrl);
      if (match) {
        const contentType = match[1] || 'audio/ogg';
        const buffer = Buffer.from(match[2]!, 'base64');
        return {
          buffer,
          contentType,
          contentLength: buffer.length,
          statusCode: 200,
        };
      }
    }

    // 2. Direct HTTP/HTTPS audio (e.g. CDN or mock in tests)
    if (
      (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) &&
      !audioUrl.includes('api.telegram.org')
    ) {
      const audioRes = await fetch(
        audioUrl,
        rangeHeader ? { headers: { Range: rangeHeader } } : {},
      );
      if (!audioRes.ok || !audioRes.body) {
        throw new ApiError(
          502,
          'BAD_GATEWAY',
          `Failed to fetch external audio stream (status ${audioRes.status})`,
        );
      }
      return {
        stream: audioRes.body,
        contentType: audioRes.headers.get('content-type') || 'audio/ogg',
        contentLength: audioRes.headers.get('content-length'),
        statusCode: audioRes.status,
        contentRange: audioRes.headers.get('content-range'),
      };
    }

    // 3. Telegram audio resolution
    let fileId = audioUrl;
    if (audioUrl.startsWith('telegram:')) {
      fileId = audioUrl.slice(9).trim();
    } else if (audioUrl.includes('api.telegram.org')) {
      const botToken = env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const directRes = await fetch(
          audioUrl,
          rangeHeader ? { headers: { Range: rangeHeader } } : {},
        );
        if (directRes.ok && directRes.body) {
          return {
            stream: directRes.body,
            contentType: directRes.headers.get('content-type') || 'audio/ogg',
            contentLength: directRes.headers.get('content-length'),
            statusCode: directRes.status,
            contentRange: directRes.headers.get('content-range'),
          };
        }
      }
      throw new ApiError(
        410,
        'GONE',
        'Legacy direct Telegram audio URL has expired. Submissions now use permanent 0 MB file IDs.',
      );
    }

    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new ApiError(
        503,
        'SERVICE_UNAVAILABLE',
        'Telegram bot token is not configured on the server',
      );
    }

    const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`;
    const getFileRes = await fetch(getFileUrl);
    if (!getFileRes.ok) {
      throw new ApiError(
        502,
        'BAD_GATEWAY',
        `Failed to resolve Telegram file (status ${getFileRes.status})`,
      );
    }

    const fileInfo = (await getFileRes.json()) as {
      ok: boolean;
      result?: { file_path?: string; file_size?: number };
      description?: string;
    };

    if (!fileInfo.ok || !fileInfo.result?.file_path) {
      throw new ApiError(
        502,
        'BAD_GATEWAY',
        fileInfo.description || 'Telegram API could not resolve file path',
      );
    }

    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
    const audioRes = await fetch(
      downloadUrl,
      rangeHeader ? { headers: { Range: rangeHeader } } : {},
    );
    if (!audioRes.ok || !audioRes.body) {
      throw new ApiError(
        502,
        'BAD_GATEWAY',
        `Failed to stream audio from Telegram (status ${audioRes.status})`,
      );
    }

    const remoteContentType = audioRes.headers.get('content-type');
    const filePath = (fileInfo.result.file_path || '').toLowerCase();
    let effectiveContentType = 'audio/ogg';
    if (filePath.endsWith('.mp3')) {
      effectiveContentType = 'audio/mpeg';
    } else if (filePath.endsWith('.m4a') || filePath.endsWith('.mp4')) {
      effectiveContentType = 'audio/mp4';
    } else if (filePath.endsWith('.wav')) {
      effectiveContentType = 'audio/wav';
    } else if (remoteContentType && remoteContentType.startsWith('audio/')) {
      effectiveContentType = remoteContentType;
    }

    return {
      stream: audioRes.body,
      contentType: effectiveContentType,
      contentLength: audioRes.headers.get('content-length') || fileInfo.result.file_size,
      statusCode: audioRes.status,
      contentRange: audioRes.headers.get('content-range'),
    };
  }
}

export interface SubmissionAudioResult {
  stream?: NodeJS.ReadableStream | ReadableStream<Uint8Array> | undefined;
  buffer?: Buffer | undefined;
  contentType: string;
  contentLength?: string | number | null | undefined;
  statusCode?: number | undefined;
  contentRange?: string | null | undefined;
}
