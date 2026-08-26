import type { PrismaClient } from '@prisma/client';

import type { NotificationJobPayload } from '../../queue/notification-queue.js';
import { buildNotificationMessage, escapeHtml, type NotificationPayloadData } from './telegram-messages.js';
import { sendTelegramMessage } from './telegram-sender.js';

export function createNotificationProcessor(prisma: PrismaClient) {
  return async function processNotification(payload: NotificationJobPayload): Promise<void> {
    const log = await prisma.telegramNotificationLog.findUnique({
      where: { id: payload.logId },
      include: { telegramLink: { include: { student: true } } },
    });
    if (!log) return;
    if (log.status === 'SENT') return;

    const { telegramLink: link } = log;

    if (link.status !== 'ACTIVE') {
      await prisma.telegramNotificationLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Recipient link is not active',
          attempts: { increment: 1 },
        },
      });
      return;
    }

    let data: NotificationPayloadData = {};
    try {
      data = JSON.parse(log.payload) as NotificationPayloadData;
    } catch {
      data = {};
    }
    if (!data.studentName && link.student) {
      data.studentName = `${link.student.lastName} ${link.student.firstName}`;
    }

    const message = buildNotificationMessage(log.triggerType.toLowerCase() as never, data);

    try {
      await prisma.telegramNotificationLog.update({
        where: { id: log.id },
        data: { attempts: { increment: 1 } },
      });
      await sendTelegramMessage(link.telegramChatId, message);
      await prisma.telegramNotificationLog.update({
        where: { id: log.id },
        data: { status: 'SENT', sentAt: new Date(), errorMessage: null },
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      const attempts = await prisma.telegramNotificationLog.findUnique({
        where: { id: log.id },
        select: { attempts: true, maxAttempts: true },
      });
      const exhausted =
        attempts && attempts.attempts >= attempts.maxAttempts ? true : false;
      await prisma.telegramNotificationLog
        .update({
          where: { id: log.id },
          data: {
            ...(exhausted ? { status: 'FAILED' as const } : {}),
            errorMessage: messageText.slice(0, 500),
          },
        })
        .catch(() => undefined);
      throw error;
    }
  };
}

export function buildLinkStatusMessage(
  studentName: string,
  studentCode: string,
  status: 'ACTIVE' | 'REJECTED',
): string {
  const name = escapeHtml(studentName);
  const code = escapeHtml(studentCode);
  if (status === 'ACTIVE') {
    return [
      `🎉 <b>So'rovingiz tasdiqlandi!</b>`,
      '',
      `🎓 <b>O'quvchi:</b> ${name} (<code>${code}</code>)`,
      '',
      "✨ Endi bot imkoniyatlaridan to'liq foydalanishingiz mumkin. Pastdagi tugmalardan birini bosing:",
    ].join('\n');
  }
  return [
    `❌ <b>So'rovingiz rad etildi</b>`,
    '',
    'Administrator so\'rovingizni rad etdi. Savollaringiz bo\'lsa, o\'quv markazi bilan bog\'laning.',
  ].join('\n');
}
