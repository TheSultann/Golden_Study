import { Redis } from 'ioredis';

import { env } from './env.js';

let client: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      lazyConnect: false,
    });
    client.on('error', (error) => {
      console.error('[redis] connection error:', error.message);
    });
  }
  return client;
}

export async function pingRedis(timeoutMs = 1500): Promise<boolean> {
  try {
    const connection = getRedisConnection();
    const result = await Promise.race([
      connection.ping(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('redis ping timeout')), timeoutMs);
      }),
    ]);
    return result === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
  }
}
