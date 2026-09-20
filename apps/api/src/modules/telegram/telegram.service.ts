import type {
  TelegramBotOverview,
  TelegramLink,
  TelegramLinkStatus,
  TelegramNotificationLog,
  TelegramTriggerType,
} from '@golden-study/contracts';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import type { NotificationQueue } from '../../queue/notification-queue.js';
import type { NotificationPayloadData } from './telegram-messages.js';
import { mainMenuKeyboard, sendTelegramMessage } from './telegram-sender.js';
import { buildLinkStatusMessage, createNotificationProcessor } from './notification.processor.js';

export type TelegramNotifier = TelegramService;

function toTelegramTrigger(prismaType: string): string {
  return prismaType.toLowerCase();
}

export class TelegramService {
  public readonly processor: (payload: { logId: string }) => Promise<void>;

  public constructor(
    private readonly prisma: PrismaClient,
    private readonly queue: NotificationQueue,
  ) {
    this.processor = createNotificationProcessor(prisma);
  }

  public async getOverview(): Promise<TelegramBotOverview> {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [links, notifications, queuedCount, failedCount, sentTodayCount] =
      await Promise.all([
        this.prisma.telegramLink.findMany({
          include: { student: true },
          orderBy: { requestedAt: 'desc' },
        }),
        this.prisma.telegramNotificationLog.findMany({
          orderBy: { queuedAt: 'desc' },
          take: 50,
        }),
        this.prisma.telegramNotificationLog.count({ where: { status: 'QUEUED' } }),
        this.prisma.telegramNotificationLog.count({ where: { status: 'FAILED' } }),
        this.prisma.telegramNotificationLog.count({
          where: { status: 'SENT', sentAt: { gte: dayStart } },
        }),
      ]);

    const formattedLinks: TelegramLink[] = links.map((link) => ({
      id: link.id,
      telegramChatId: link.telegramChatId,
      studentId: link.studentId,
      studentCode: link.student?.studentCode ?? '',
      studentName: link.student
        ? `${link.student.lastName} ${link.student.firstName}`
        : 'O‘quvchi',
      parentName: link.parentName || link.student?.parentName || 'Ota-ona',
      parentPhone: link.parentPhone || link.student?.parentPhone || '',
      status: link.status.toLowerCase() as TelegramLinkStatus,
      requestedAt: new Date(link.requestedAt).toISOString(),
    }));

    const formattedNotifications: TelegramNotificationLog[] = notifications.map(
      (n) => ({
        id: n.id,
        telegramLinkId: n.telegramLinkId,
        triggerType: n.triggerType.toLowerCase() as TelegramTriggerType,
        status: n.status.toLowerCase() as 'queued' | 'sent' | 'failed',
        payload: n.payload,
        queuedAt: new Date(n.queuedAt).toISOString(),
        sentAt: n.sentAt ? new Date(n.sentAt).toISOString() : null,
        attempts: n.attempts,
        maxAttempts: n.maxAttempts,
        errorMessage: n.errorMessage,
        jobId: n.jobId,
      }),
    );

    return {
      links: formattedLinks,
      notifications: formattedNotifications,
      queue: {
        waiting: queuedCount,
        active: 0,
        failed: failedCount,
        sentToday: sentTodayCount,
      },
      service: {
        mode: 'polling',
        status: 'online',
        lastHeartbeatAt: new Date().toISOString(),
      },
    };
  }

  public async setLinkStatus(
    id: string,
    status: TelegramLinkStatus,
  ): Promise<TelegramLink> {
    const prismaStatus = status.toUpperCase() as 'PENDING' | 'ACTIVE' | 'REJECTED';

    const updated = await this.prisma.telegramLink.update({
      where: { id },
      data: { status: prismaStatus },
      include: { student: true },
    });

    if (prismaStatus === 'ACTIVE' || prismaStatus === 'REJECTED') {
      const text = buildLinkStatusMessage(
        `${updated.student.lastName} ${updated.student.firstName}`,
        updated.student.studentCode,
        prismaStatus,
      );
      const replyMarkup = prismaStatus === 'ACTIVE' ? mainMenuKeyboard() : undefined;
      void sendTelegramMessage(updated.telegramChatId, text, replyMarkup).catch(
        (error) => {
          console.error('[telegram] link status message failed:', error);
        },
      );
    }

    return {
      id: updated.id,
      telegramChatId: updated.telegramChatId,
      studentId: updated.studentId,
      studentCode: updated.student.studentCode,
      studentName: `${updated.student.lastName} ${updated.student.firstName}`,
      parentName: updated.parentName || updated.student.parentName || 'Ota-ona',
      parentPhone: updated.parentPhone || updated.student.parentPhone || '',
      status: updated.status.toLowerCase() as TelegramLinkStatus,
      requestedAt: new Date(updated.requestedAt).toISOString(),
    };
  }

  public async notifyStudent(
    studentId: string,
    triggerType: TelegramTriggerType,
    payload?: NotificationPayloadData,
    operationKey?: string,
  ): Promise<boolean> {
    const link = await this.prisma.telegramLink.findFirst({
      where: { studentId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!link) return false;
    await this.enqueueToLink(link.id, triggerType, payload, operationKey);
    return true;
  }

  public async enqueueToLink(
    linkId: string,
    triggerType: TelegramTriggerType,
    payload?: Record<string, unknown>,
    operationKey?: string,
    delayMs?: number,
  ): Promise<TelegramNotificationLog> {
    const prismaTrigger = triggerType.toUpperCase() as
      | 'ATTENDANCE_ABSENT'
      | 'HOMEWORK_MISSING'
      | 'EXAM_RESULT'
      | 'PAYMENT_RECEIVED'
      | 'DEBT_REMINDER'
      | 'ANNOUNCEMENT'
      | 'LESSON_BROADCAST';

    const existing = operationKey
      ? await this.prisma.telegramNotificationLog.findUnique({
          where: { jobId: operationKey },
        })
      : null;
    if (existing) {
      return this.toApi(existing);
    }

    const created = await this.prisma.telegramNotificationLog
      .create({
        data: {
          telegramLinkId: linkId,
          triggerType: prismaTrigger,
          status: 'QUEUED',
          payload: JSON.stringify(payload ?? {}),
          jobId: operationKey ?? randomUUID(),
        },
      })
      .catch(async (error: unknown) => {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code: string }).code === 'P2002'
        ) {
          const raced = await this.prisma.telegramNotificationLog.findUnique({
            where: { jobId: operationKey ?? '' },
          });
          if (raced) return raced;
        }
        throw error;
      });

    await this.queue.enqueue(
      { logId: created.id },
      { jobId: created.jobId, delayMs },
    );
    return this.toApi(created);
  }

  private toApi(log: {
    id: string;
    telegramLinkId: string;
    triggerType: string;
    status: string;
    payload: string;
    queuedAt: Date;
    sentAt: Date | null;
    attempts: number;
    maxAttempts: number;
    errorMessage: string | null;
    jobId: string;
  }): TelegramNotificationLog {
    return {
      id: log.id,
      telegramLinkId: log.telegramLinkId,
      triggerType: toTelegramTrigger(log.triggerType) as TelegramTriggerType,
      status: log.status.toLowerCase() as 'queued' | 'sent' | 'failed',
      payload: log.payload,
      queuedAt: new Date(log.queuedAt).toISOString(),
      sentAt: log.sentAt ? new Date(log.sentAt).toISOString() : null,
      attempts: log.attempts,
      maxAttempts: log.maxAttempts,
      errorMessage: log.errorMessage,
      jobId: log.jobId,
    };
  }
}
