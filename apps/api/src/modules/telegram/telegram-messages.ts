import type { TelegramTriggerType } from '@golden-study/contracts';

export interface NotificationPayloadData {
  [key: string]: unknown;
  studentName?: string | undefined;
  groupName?: string | undefined;
  date?: string | undefined;
  topic?: string | undefined;
  homeworkText?: string | undefined;
  nextLesson?: string | undefined;
  status?: string | undefined;
  rating?: number | null | undefined;
  homeworkScore?: number | null | undefined;
  topicScore?: number | null | undefined;
  dictionaryScore?: number | null | undefined;
  comment?: string | undefined;
  amountUzs?: number | undefined;
  method?: string | undefined;
  examName?: string | undefined;
  score?: number | undefined;
  maxScore?: number | undefined;
  balanceUzs?: number | undefined;
  title?: string | undefined;
  body?: string | undefined;
}

export function escapeHtml(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text)
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
    case 'lesson_broadcast': {
      const lines: string[] = [
        `📚 <b>Dars xulosasi${data.groupName ? `: ${escapeHtml(data.groupName)}` : ''}</b>`,
        ...(data.date ? [`📅 Sana: <b>${escapeHtml(data.date)}</b>`] : []),
        '',
        ...(data.topic ? [`📘 <b>Bugungi mavzu:</b> ${escapeHtml(data.topic)}`] : []),
        ...(data.homeworkText ? [`📝 <b>Keyingi darsga vazifa:</b> ${escapeHtml(data.homeworkText)}`] : []),
        ...(data.nextLesson ? [`⏰ <b>Keyingi dars:</b> ${escapeHtml(data.nextLesson)}`] : []),
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        `👤 <b>O‘quvchi:</b> ${name}`,
      ];

      if (data.status) {
        const statusUpper = String(data.status).toUpperCase();
        const statusText =
          statusUpper === 'CAME'
            ? '✅ Keldi'
            : statusUpper === 'EXCUSED'
              ? '🟡 Sababli'
              : '❌ Sababsiz';
        lines.push(`📊 <b>Davomat:</b> ${statusText}`);

        if (typeof data.rating === 'number') {
          lines.push(`⭐️ <b>Umumiy baho:</b> <b>${data.rating}%</b>`);
        }
        const breakdownParts: string[] = [];
        if (typeof data.homeworkScore === 'number') {
          breakdownParts.push(`   ▫️ Uy vazifasi: <b>${data.homeworkScore}%</b>`);
        }
        if (typeof data.topicScore === 'number') {
          breakdownParts.push(`   ▫️ Darsdagi faollik: <b>${data.topicScore}%</b>`);
        }
        if (typeof data.dictionaryScore === 'number') {
          breakdownParts.push(`   ▫️ Lug‘at / Test: <b>${data.dictionaryScore}%</b>`);
        }
        if (breakdownParts.length > 0) {
          lines.push(breakdownParts.join('\n'));
        }

        if (data.comment) {
          lines.push(`💬 <b>O‘qituvchi izohi:</b> <i>${escapeHtml(data.comment)}</i>`);
        }
      } else {
        lines.push('📊 <b>Davomat:</b> <i>(Hozircha baholanmagan)</i>');
      }

      return lines.filter((l) => l !== undefined).join('\n');
    }
    default:
      return `📢 <b>Bildirishnoma</b>\n\n🎓 <b>O'quvchi:</b> ${name}`;
  }
}

/**
 * Public broadcast message for Telegram Group Chat.
 * STRICT PRIVACY REQUIREMENT: Contains ONLY public lesson info (topic, homework, next lesson).
 * Contains ZERO individual student names, statuses, scores, or debts!
 */
export function buildGroupLessonBroadcastMessage(data: {
  groupName: string;
  date?: string | undefined;
  topic?: string | undefined;
  homeworkText?: string | undefined;
  nextLesson?: string | undefined;
}): string {
  const lines: string[] = [
    `📚 <b>Dars xulosasi: ${escapeHtml(data.groupName)}</b>`,
    ...(data.date ? [`📅 Sana: <b>${escapeHtml(data.date)}</b>`] : []),
    '',
    ...(data.topic ? [`📘 <b>Bugungi mavzu:</b> ${escapeHtml(data.topic)}`] : []),
    ...(data.homeworkText ? [`📝 <b>Keyingi darsga vazifa:</b> ${escapeHtml(data.homeworkText)}`] : []),
    ...(data.nextLesson ? [`⏰ <b>Keyingi dars:</b> ${escapeHtml(data.nextLesson)}`] : []),
  ];
  return lines.filter((l) => l !== undefined).join('\n');
}

