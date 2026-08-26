import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { closeAllNotificationQueues } from './queue/notification-queue.js';

const server = createApp().listen(env.API_PORT, '0.0.0.0', () => {
  logger.info({ port: env.API_PORT, host: '0.0.0.0' }, 'API server started');
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, 'API server shutting down');

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    await closeAllNotificationQueues();
    logger.info('API server stopped');
  } catch (error) {
    logger.error({ err: error }, 'API server shutdown failed');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
