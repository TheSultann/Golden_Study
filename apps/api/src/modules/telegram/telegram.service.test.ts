import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { TelegramService } from './telegram.service.js';
import { MemoryNotificationQueue } from '../../queue/notification-queue.js';

interface LogRow {
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
}

function createFakePrisma(options: {
  activeLink?: { id: string; studentId: string };
}) {
  const logs: LogRow[] = [];
  let logSeq = 0;

  const prisma = {
    telegramLink: {
      findFirst(args: {
        where: { studentId?: string; status?: string };
      }) {
        if (
          options.activeLink &&
          args.where.studentId === options.activeLink.studentId &&
          args.where.status === 'ACTIVE'
        ) {
          return Promise.resolve(options.activeLink);
        }
        return Promise.resolve(null);
      },
    },
    telegramNotificationLog: {
      findUnique(args: { where: { jobId?: string; id?: string } }) {
        return Promise.resolve(
          logs.find((log) => log.jobId === args.where.jobId) ??
            logs.find((log) => log.id === args.where.id) ??
            null,
        );
      },
      create(args: { data: Partial<LogRow> }) {
        const row: LogRow = {
          id: `log-${++logSeq}`,
          telegramLinkId: args.data.telegramLinkId ?? '',
          triggerType: args.data.triggerType ?? 'ANNOUNCEMENT',
          status: args.data.status ?? 'QUEUED',
          payload: args.data.payload ?? '{}',
          queuedAt: new Date(),
          sentAt: null,
          attempts: 0,
          maxAttempts: 3,
          errorMessage: null,
          jobId: args.data.jobId ?? `job-${++logSeq}`,
        };
        logs.push(row);
        return Promise.resolve(row);
      },
    },
  };

  return { prisma: prisma as unknown as PrismaClient, logs };
}

describe('TelegramService notifications', () => {
  let queue: MemoryNotificationQueue;
  const processed: string[] = [];

  beforeEach(() => {
    queue = new MemoryNotificationQueue();
    queue.register(async (payload) => {
      processed.push(payload.logId);
    });
    processed.length = 0;
  });

  it('skips notification when student has no ACTIVE link', async () => {
    const { prisma, logs } = createFakePrisma({});
    const service = new TelegramService(prisma, queue);

    const result = await service.notifyStudent('student-1', 'payment_received');

    expect(result).toBe(false);
    expect(logs).toHaveLength(0);
  });

  it('creates a QUEUED log and processes it through the queue', async () => {
    const { prisma, logs } = createFakePrisma({
      activeLink: { id: 'link-1', studentId: 'student-1' },
    });
    const service = new TelegramService(prisma, queue);

    const result = await service.notifyStudent(
      'student-1',
      'payment_received',
      { amountUzs: 500000 },
      'payment-received:p1',
    );

    expect(result).toBe(true);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe('QUEUED');
    expect(logs[0]?.triggerType).toBe('PAYMENT_RECEIVED');
    await queue.whenIdle();
    expect(processed).toContain(logs[0]?.id);
  });

  it('is idempotent for the same operationKey', async () => {
    const { prisma, logs } = createFakePrisma({
      activeLink: { id: 'link-1', studentId: 'student-1' },
    });
    const service = new TelegramService(prisma, queue);

    const first = await service.enqueueToLink(
      'link-1',
      'attendance_absent',
      {},
      'att:row-1:attendance_absent',
    );
    const second = await service.enqueueToLink(
      'link-1',
      'attendance_absent',
      {},
      'att:row-1:attendance_absent',
    );

    expect(second.id).toBe(first.id);
    expect(logs).toHaveLength(1);
  });
});
