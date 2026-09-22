import { Queue, Worker } from 'bullmq';

import { env } from '../config/env.js';
import { getRedisConnection } from '../config/redis.js';

export const NOTIFICATION_QUEUE_NAME = 'telegram-notifications';

export interface NotificationJobPayload {
  logId: string;
}

export interface EnqueueOptions {
  jobId?: string | undefined;
  delayMs?: number | undefined;
}

export type NotificationProcessor = (payload: NotificationJobPayload) => Promise<void>;

export interface NotificationQueue {
  readonly kind: 'bullmq' | 'memory';
  enqueue(payload: NotificationJobPayload, options?: EnqueueOptions): Promise<void>;
  register(processor: NotificationProcessor): void;
  whenIdle(): Promise<void>;
  close(): Promise<void>;
}

export function sanitizeBullMqJobId(jobId?: string): string | undefined {
  if (!jobId) return undefined;
  return jobId.replace(/:/g, '_');
}

class BullMqNotificationQueue implements NotificationQueue {
  public readonly kind = 'bullmq' as const;
  private readonly queue: Queue<NotificationJobPayload>;

  public constructor() {
    this.queue = new Queue<NotificationJobPayload>(NOTIFICATION_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }

  public async enqueue(payload: NotificationJobPayload, options?: EnqueueOptions): Promise<void> {
    const sanitizedJobId = sanitizeBullMqJobId(options?.jobId);
    await this.queue.add('notification', payload, {
      ...(sanitizedJobId ? { jobId: sanitizedJobId } : {}),
      ...(options?.delayMs && options.delayMs > 0 ? { delay: options.delayMs } : {}),
      attempts: 5,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86_400 },
    });
  }

  public register(): void {
    // processing is handled by a dedicated Worker started in server.ts
  }

  public async whenIdle(): Promise<void> {
    return;
  }

  public async close(): Promise<void> {
    await this.queue.close();
  }
}

interface MemoryJob {
  payload: NotificationJobPayload;
  timer: NodeJS.Timeout;
}

export class MemoryNotificationQueue implements NotificationQueue {
  public readonly kind = 'memory' as const;
  private readonly jobs = new Map<string, MemoryJob>();
  private processor: NotificationProcessor | null = null;

  public register(processor: NotificationProcessor): void {
    this.processor = processor;
  }

  public async enqueue(
    payload: NotificationJobPayload,
    options?: EnqueueOptions,
  ): Promise<void> {
    const key = options?.jobId ?? payload.logId;
    if (this.jobs.has(key)) return;

    if (!this.processor) return;

    const run = async () => {
      this.jobs.delete(key);
      try {
        await this.processor?.(payload);
      } catch (error) {
        console.error('[queue] memory job failed:', error);
      }
    };
    const timer = setTimeout(() => void run(), Math.min(options?.delayMs ?? 0, 50));
    this.jobs.set(key, { payload, timer });
  }

  public async whenIdle(): Promise<void> {
    const pending = [...this.jobs.values()];
    if (pending.length === 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    await this.whenIdle();
  }

  public async close(): Promise<void> {
    for (const job of this.jobs.values()) clearTimeout(job.timer);
    this.jobs.clear();
  }
}

const activeQueues: NotificationQueue[] = [];

export function createNotificationQueue(): NotificationQueue {
  const useMemory = env.NODE_ENV === 'test' || env.QUEUE_DRIVER === 'memory';
  const queue: NotificationQueue = useMemory
    ? new MemoryNotificationQueue()
    : new BullMqNotificationQueue();
  activeQueues.push(queue);
  return queue;
}

export function startNotificationWorker(processor: NotificationProcessor): Worker {
  return new Worker(NOTIFICATION_QUEUE_NAME, async (job) => processor(job.data), {
    connection: getRedisConnection(),
  });
}

export async function closeAllNotificationQueues(): Promise<void> {
  await Promise.all(activeQueues.map((queue) => queue.close()));
  activeQueues.length = 0;
}
