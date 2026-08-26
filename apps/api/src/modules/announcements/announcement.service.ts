import type {
  Announcement,
  AnnouncementSendInput,
} from '@golden-study/contracts';
import type { PrismaClient } from '@prisma/client';

import { ApiError } from '../../common/errors/api-error.js';
import type { TelegramNotifier } from '../telegram/telegram.service.js';

export class AnnouncementService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly notifier?: TelegramNotifier,
  ) {}

  public async list(): Promise<Announcement[]> {
    const rows = await this.prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(toApi);
  }

  public async send(
    input: AnnouncementSendInput,
    actorUserId: string,
  ): Promise<Announcement> {
    const target = await this.resolveTarget(input);

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const isScheduled =
      scheduledAt !== null && !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getTime() > Date.now();

    const row = await this.prisma.announcement.create({
      data: {
        targetType: input.targetType.toUpperCase() as 'ALL' | 'GROUP' | 'COURSE',
        targetId: input.targetId ?? null,
        targetName: target.name,
        title: input.title,
        body: input.body,
        deliveryStatus: 'QUEUED',
        scheduledAt: scheduledAt,
        createdByUserId: actorUserId,
      },
    });

    const announcementId = row.id;
    if (isScheduled && scheduledAt) {
      await this.prisma.announcement.update({
        where: { id: announcementId },
        data: { deliveryStatus: 'SCHEDULED' },
      });
      await this.broadcast(announcementId, input, {
        delayMs: Math.max(scheduledAt.getTime() - Date.now(), 0),
      });
      const updated = await this.prisma.announcement.findUniqueOrThrow({
        where: { id: announcementId },
      });
      return toApi(updated);
    }

    const recipientCount = await this.broadcast(announcementId, input);
    const delivered = recipientCount > 0;
    const updated = await this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        deliveryStatus: delivered ? 'BOT_DELIVERED' : 'FAILED',
        deliveredAt: delivered ? new Date() : null,
      },
    });
    return toApi(updated);
  }

  private async broadcast(
    announcementId: string,
    input: AnnouncementSendInput,
    options?: { delayMs?: number },
  ): Promise<number> {
    if (!this.notifier) return 0;
    const links = await this.resolveRecipientLinks(input);
    for (const link of links) {
      await this.notifier
        .enqueueToLink(
          link.id,
          'announcement',
          { title: input.title, body: input.body },
          `announcement:${announcementId}:${link.id}`,
          options?.delayMs,
        )
        .catch((error) => {
          console.error('[telegram] announcement enqueue failed:', error);
        });
    }
    return links.length;
  }

  private resolveRecipientLinks(
    input: AnnouncementSendInput,
  ): Promise<Array<{ id: string }>> {
    const base = { status: 'ACTIVE' as const };
    switch (input.targetType) {
      case 'group':
        return this.prisma.telegramLink.findMany({
          where: {
            ...base,
            student: {
              groups: { some: { groupId: input.targetId ?? '__missing__' } },
            },
          },
          select: { id: true },
        });
      case 'course':
        return this.prisma.telegramLink.findMany({
          where: {
            ...base,
            student: {
              groups: {
                some: { group: { courseId: input.targetId ?? '__missing__' } },
              },
            },
          },
          select: { id: true },
        });
      default:
        return this.prisma.telegramLink.findMany({
          where: base,
          select: { id: true },
        });
    }
  }

  private async resolveTarget(
    input: AnnouncementSendInput,
  ): Promise<{ name: string }> {
    if (input.targetType === 'all') {
      return { name: "Barcha ota-onalar" };
    }
    if (!input.targetId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'targetId required');
    }
    if (input.targetType === 'group') {
      const group = await this.prisma.group.findUnique({
        where: { id: input.targetId },
        select: { name: true },
      });
      if (!group) throw new ApiError(404, 'NOT_FOUND', 'Group not found');
      return { name: group.name };
    }
    const course = await this.prisma.course.findUnique({
      where: { id: input.targetId },
      select: { title: true },
    });
    if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
    return { name: course.title };
  }
}

type AnnouncementRow = {
  id: string;
  targetType: string;
  targetId: string | null;
  targetName: string;
  title: string;
  body: string;
  deliveryStatus: string;
  createdAt: Date;
  scheduledAt: Date | null;
  deliveredAt: Date | null;
};

const deliveryStatusToApi: Record<string, Announcement['deliveryStatus']> = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  QUEUED: 'queued',
  BOT_DELIVERED: 'BOT_DELIVERED',
  FAILED: 'failed',
};

function toApi(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    targetType: row.targetType.toLowerCase() as 'all' | 'group' | 'course',
    targetId: row.targetId,
    targetName: row.targetName,
    title: row.title,
    body: row.body,
    deliveryStatus:
      deliveryStatusToApi[row.deliveryStatus] ??
      (row.deliveryStatus.toLowerCase() as Announcement['deliveryStatus']),
    createdAt: new Date(row.createdAt).toISOString(),
    scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
    deliveredAt: row.deliveredAt ? new Date(row.deliveredAt).toISOString() : null,
  };
}
