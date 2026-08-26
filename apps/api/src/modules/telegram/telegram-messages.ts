import type { TelegramTriggerType } from '@golden-study/contracts';

export interface NotificationPayloadData {
  [key: string]: unknown;
  studentName?: string;
  date?: string;
  amountUzs?: number;
  method?: string;
  examName?: string;
  score?: number;
  maxScore?: number;
  balanceUzs?: number;
  title?: string;
  body?: string;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('uz-UZ').format(value);
}

export function buildNotificationMessage(
  triggerType: TelegramTriggerType,
  data: NotificationPayloadData,
): string {
  const name = escapeHtml(data.studentName ?? 'O‘quvchi');

  switch (triggerType) {
    case 'attendance_absent':
      return [
        '⚠️ <b>Bildirishnoma: Davomat</b>',
        '',
        `🎓 <b>O'quvchi:</b> ${name}`,
        ...(data.date ? [`📅 Sana: ${escapeHtml(data.date)}`] : []),
        '❌ Farzandingiz bugungi darsga sababsiz kelmadi.',
      ].join('\n');
    case 'homework_missing':
      return [
        '📝 <b>Bildirishnoma: Uy vazifasi</b>',
        '',
        `🎓 <b>O'quvchi:</b> ${name}`,
        ...(data.date ? [`📅 Sana: ${escapeHtml(data.date)}`] : []),
        '⚠️ Farzandingiz bugungi uy vazifasini bajarmadi.',
      ].join('\n');
    case 'exam_result': {
      const score =
        typeof data.score === 'number' && typeof data.maxScore === 'number'
          ? `\n📊 Natija: <b>${data.score}</b> / ${data.maxScore} ball`
          : '';
      return [
        '🎯 <b>Bildirishnoma: Imtihon natijasi</b>',
        '',
        `🎓 <b>O'quvchi:</b> ${name}`,
        ...(data.examName ? [`📌 Imtihon: ${escapeHtml(data.examName)}`] : []),
        score,
        '',
        "Batafsil ma'lumot uchun botdagi 🎯 Imtihonlar tugmasini bosing.",
      ]
        .filter((line) => line.length > 0)
        .join('\n');
    }
    case 'payment_received': {
      const amount =
        typeof data.amountUzs === 'number'
          ? `\n💵 Summa: <b>${formatMoney(data.amountUzs)} UZS</b>`
          : '';
      return [
        '💳 <b>To\'lov qabul qilindi</b>',
        '',
        `🎓 <b>O'quvchi:</b> ${name}`,
        amount,
        '✅ To\'lov muvaffaqiyatli qabul qilindi. Rahmat!',
      ]
        .filter((line) => line.length > 0)
        .join('\n');
    }
    case 'debt_reminder': {
      const balance =
        typeof data.balanceUzs === 'number' && data.balanceUzs < 0
          ? `\n💰 Qarzdorlik: <b>${formatMoney(Math.abs(data.balanceUzs))} UZS</b>`
          : '';
      return [
        '🔔 <b>Eslatma: Qarzdorlik</b>',
        '',
        `🎓 <b>O'quvchi:</b> ${name}`,
        balance,
        "Iltimos, o'quv kursi uchun to'lovni o'z vaqtida amalga oshiring.",
      ]
        .filter((line) => line.length > 0)
        .join('\n');
    }
    case 'announcement':
      return [
        '📢 <b>Markaz e\'loni</b>',
        ...(data.title ? ['', `<b>${escapeHtml(data.title)}</b>`] : []),
        ...(data.body ? ['', escapeHtml(data.body)] : []),
      ].join('\n');
    default:
      return `📢 <b>Bildirishnoma</b>\n\n🎓 <b>O'quvchi:</b> ${name}`;
  }
}
