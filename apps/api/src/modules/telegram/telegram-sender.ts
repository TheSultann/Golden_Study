import { env } from '../../config/env.js';

export async function sendTelegramMessage(
  chatId: string,
  html: string,
  replyMarkup?: unknown,
): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(
      `Telegram API error ${response.status}: ${details.slice(0, 300)}`,
    );
  }
}

export function mainMenuKeyboard(): unknown {
  return {
    keyboard: [
      [{ text: '📊 Davomat' }, { text: '💳 To\'lovlar' }],
      [{ text: '📝 Uy vazifalari' }, { text: '⭐ Reyting' }],
      [{ text: '🎯 Imtihonlar' }],
    ],
    resize_keyboard: true,
  };
}
