import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { Telegraf, Markup } from 'telegraf';
import path from 'node:path';
import type { InputRichBlock, RichText } from './rich-message.js';
import { bold } from './rich-message.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken && process.env.NODE_ENV !== 'test') {
  console.error('TELEGRAM_BOT_TOKEN is not set. Add it to the root .env file.');
  process.exit(1);
}
export const prisma = new PrismaClient();
const defaultBotUsername = process.env.TELEGRAM_BOT_USERNAME || 'Golden_StudyBot';
export const bot = new Telegraf(botToken || '000000000:TEST_TOKEN_FOR_TESTS');
if (!(bot as any).botInfo) {
  (bot as any).botInfo = {
    username: defaultBotUsername,
    first_name: 'Golden Study',
    is_bot: true,
  };
}

const mainMenu = Markup.keyboard([
  ['📊 Davomat', '💳 To\'lovlar'],
  ['📝 Uy vazifalari', '⭐ Reyting'],
  ['🎯 Imtihonlar']
]).resize();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(val: number): string {
  return new Intl.NumberFormat('uz-UZ').format(val);
}

function formatDateUz(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Tashkent',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}`;
}

export function computeSmartAverage(...scores: (number | null | undefined)[]): number | null {
  const valid = scores.filter((s): s is number => typeof s === 'number' && !isNaN(s));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export function formatScoresBreakdown(hw: number | null | undefined, topic: number | null | undefined, dict: number | null | undefined): string {
  const parts: string[] = [];
  if (typeof hw === 'number') parts.push(`Uyga vazifa: ${hw}%`);
  if (typeof topic === 'number') parts.push(`Mavzu: ${topic}%`);
  if (typeof dict === 'number') parts.push(`Lug‘at: ${dict}%`);
  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

export function parseLessonPlan(raw: string): { topic: string; homeworkText: string } {
  if (!raw) return { topic: '', homeworkText: '' };
  const trimmed = raw.trim();
  const match = trimmed.match(/^Mavzu:\s*([^\n]+)(?:\n+(?:Vazifa:\s*)?([\s\S]*))?$/i);
  if (match) {
    return {
      topic: match[1]?.trim() ?? '',
      homeworkText: match[2]?.trim() ?? '',
    };
  }
  return { topic: '', homeworkText: trimmed };
}

type StudentRatingRow = {
  studentId: string;
  studentCode: string;
  studentName: string;
  groupName: string;
  examsCount: number;
  averagePercent: number;
  attendanceRating: number;
  homeworkRate: number;
  totalScore: number;
  stars: number;
};

async function getStudentRating(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      groups: {
        include: {
          group: {
            include: {
              students: {
                include: {
                  student: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!student || student.groups.length === 0) return null;

  const groupObj = student.groups[0].group;

  const exams = await prisma.exam.findMany({
    where: { groupId: groupObj.id },
    include: { results: true },
  });

  const attendanceRecords = await prisma.attendance.findMany({
    where: { groupId: groupObj.id, isReversed: false },
  });

  const rowsMap = new Map<string, StudentRatingRow>();

  groupObj.students.forEach((gs) => {
    rowsMap.set(gs.studentId, {
      studentId: gs.studentId,
      studentCode: gs.student.studentCode,
      studentName: `${gs.student.lastName} ${gs.student.firstName}`.trim(),
      groupName: groupObj.name,
      examsCount: 0,
      averagePercent: 0,
      attendanceRating: 0,
      homeworkRate: 0,
      totalScore: 0,
      stars: 0,
    });
  });

  exams.forEach((exam) => {
    exam.results.forEach((res) => {
      const row = rowsMap.get(res.studentId);
      if (row) {
        const percent = Math.round((res.score / exam.maxScore) * 100);
        row.averagePercent = Math.round(
          (row.averagePercent * row.examsCount + percent) / (row.examsCount + 1),
        );
        row.examsCount += 1;
      }
    });
  });

  const studentAttMap = new Map<
    string,
    { totalRating: number; ratingCount: number; hwDone: number; totalHw: number }
  >();

  attendanceRecords.forEach((att) => {
    const prev = studentAttMap.get(att.studentId) || {
      totalRating: 0,
      ratingCount: 0,
      hwDone: 0,
      totalHw: 0,
    };
    if (typeof att.rating === 'number' && !isNaN(att.rating)) {
      prev.totalRating += att.rating;
      prev.ratingCount += 1;
    }
    prev.totalHw += 1;
    if (att.homeworkDone) prev.hwDone += 1;
    studentAttMap.set(att.studentId, prev);
  });

  studentAttMap.forEach((attData, sId) => {
    const row = rowsMap.get(sId);
    if (row) {
      row.attendanceRating =
        attData.ratingCount > 0
          ? Math.round(attData.totalRating / attData.ratingCount)
          : 100;
      row.homeworkRate =
        attData.totalHw > 0 ? Math.round((attData.hwDone / attData.totalHw) * 100) : 0;
    }
  });

  const leaderboard = Array.from(rowsMap.values()).map((row) => {
    const examPart = row.examsCount > 0 ? row.averagePercent * 0.7 : 0;
    const attPart = row.attendanceRating ? (row.attendanceRating / 100) * 20 : 0;
    const hwPart = Math.round(row.homeworkRate * 0.1);

    let totalScore = 0;
    if (row.examsCount > 0) {
      totalScore = Math.min(100, Math.round(examPart + attPart + hwPart));
    } else if (row.attendanceRating > 0 || row.homeworkRate > 0) {
      totalScore = Math.min(100, Math.round((row.attendanceRating / 100) * 80 + row.homeworkRate * 0.2));
    } else {
      totalScore = 0;
    }

    const stars = totalScore === 0 ? 0 : Math.max(1, Math.min(5, Math.ceil(totalScore / 20)));
    return { ...row, totalScore, stars };
  });

  leaderboard.sort((a, b) => b.totalScore - a.totalScore || b.averagePercent - a.averagePercent);

  const rankIndex = leaderboard.findIndex((r) => r.studentId === studentId);
  const myRow = rankIndex !== -1 ? leaderboard[rankIndex] : null;

  return {
    groupName: groupObj.name,
    totalStudents: leaderboard.length,
    rank: rankIndex !== -1 ? rankIndex + 1 : 1,
    myRow,
    topList: leaderboard.slice(0, 5),
  };
}

async function getActiveLink(chatId: string) {
  return prisma.telegramLink.findFirst({
    where: {
      telegramChatId: chatId,
      status: 'ACTIVE',
    },
    include: {
      student: {
        include: {
          groups: {
            include: {
              group: {
                include: {
                  course: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

async function sendRichSafe(
  ctx: any,
  blocks: InputRichBlock[],
  fallbackHtml: string,
) {
  try {
    const payload: Record<string, any> = {
      chat_id: ctx.chat.id,
      rich_message: { blocks },
    };
    try { payload.reply_markup = mainMenu.reply_markup; } catch {}
    await ctx.telegram.callApi('sendRichMessage' as any, payload);
  } catch (err: any) {
    console.error('sendRichMessage failed:', err.description ?? err.error_code ?? err.message);
    try {
      await ctx.replyWithHTML(fallbackHtml, mainMenu);
    } catch { /* ignore */ }
  }
}

export function extractCleanGroupId(query: string): string {
  return query
    .trim()
    .replace(/^<|>$/g, '')
    .replace(/^https?:\/\/[^\s]+startgroup=/i, '')
    .replace(/^.*startgroup=/i, '')
    .replace(/^start=/i, '')
    .replace(/^\/(?:startgroup|start|connect|link)(?:@\w+)?(?:\s+|=)?/i, '')
    .replace(/^group_/, '')
    .replace(/^g_/, '')
    .replace(/^<|>$/g, '')
    .trim();
}

export async function connectGroupToChat(chatId: string, chatTitle: string, query: string) {
  const cleanId = extractCleanGroupId(query);
  if (!cleanId) {
    return { ok: false, error: 'Guruh ID yoki nomi kiritilmadi' };
  }

  let group = await prisma.group.findUnique({
    where: { id: cleanId },
    include: { course: true, teacher: true },
  }).catch(() => null);

  if (!group) {
    group = await prisma.group.findFirst({
      where: { name: { equals: cleanId, mode: 'insensitive' } },
      include: { course: true, teacher: true },
    });
  }

  if (!group) {
    const candidates = await prisma.group.findMany({
      where: { name: { contains: cleanId, mode: 'insensitive' } },
      include: { course: true, teacher: true },
      take: 3,
    });
    if (candidates.length === 1) {
      group = candidates[0];
    } else if (candidates.length > 1) {
      return {
        ok: false,
        error: `Bir nechta mos guruh topildi: ${candidates.map((c) => `“${c.name}”`).join(', ')}. Iltimos, aniq nomini yoki ID sini kiriting.`,
      };
    }
  }

  if (!group) {
    return { ok: false, error: `“${cleanId}” bo‘yicha guruh topilmadi` };
  }

  // Database integrity: disassociate this chatId from any other groups first
  await prisma.group.updateMany({
    where: { telegramChatId: chatId, id: { not: group.id } },
    data: { telegramChatId: null, telegramChatTitle: null },
  });

  const updated = await prisma.group.update({
    where: { id: group.id },
    data: {
      telegramChatId: chatId,
      telegramChatTitle: chatTitle || 'Telegram Guruh',
    },
    include: { course: true, teacher: true },
  });

  return { ok: true, group: updated };
}

export async function disconnectGroupFromChat(chatId: string) {
  const linked = await prisma.group.findFirst({
    where: { telegramChatId: chatId },
  });
  if (!linked) {
    return { ok: false, error: 'Ushbu chat hech qanday guruhga bog‘lanmagan' };
  }
  const updated = await prisma.group.update({
    where: { id: linked.id },
    data: {
      telegramChatId: null,
      telegramChatTitle: null,
    },
  });
  await prisma.group.updateMany({
    where: { telegramChatId: chatId, id: { not: linked.id } },
    data: {
      telegramChatId: null,
      telegramChatTitle: null,
    },
  });
  return { ok: true, group: updated };
}

export async function getLinkedGroupForChat(chatId: string) {
  return prisma.group.findFirst({
    where: { telegramChatId: chatId },
    include: { course: true, teacher: true },
  });
}

async function handleStartOrGroupStart(ctx: any) {
  const chatId = String(ctx.chat.id);
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

  if (isGroup) {
    const rawText = ctx.message && 'text' in ctx.message ? ctx.message.text.trim() : '';
    const payload =
      (ctx as any).startPayload ||
      (rawText.includes(' ') ? rawText.split(/\s+/).slice(1).join(' ') : '') ||
      (rawText.startsWith('/startgroup=') ? rawText.replace(/^\/startgroup=/, '') : '');

    const botUser = ctx.botInfo?.username || process.env.TELEGRAM_BOT_USERNAME || 'Golden_StudyBot';

    if (payload) {
      const result = await connectGroupToChat(chatId, ctx.chat.title || 'Telegram Guruh', payload);
      if (result.ok && result.group) {
        return ctx.replyWithHTML(
          `✅ <b>Guruh muvaffaqiyatli bog'landi!</b>\n\n` +
          `📚 <b>Guruh:</b> ${escapeHtml(result.group.name)}\n` +
          `📖 <b>Kurs:</b> ${escapeHtml(result.group.course?.title ?? '—')}\n` +
          `👨‍🏫 <b>O'qituvchi:</b> ${escapeHtml(`${result.group.teacher?.firstName ?? ''} ${result.group.teacher?.lastName ?? ''}`.trim())}\n` +
          `👥 <b>Chat:</b> ${escapeHtml(ctx.chat.title || '')}\n\n` +
          `Endi dars rejasi, uy vazifalari va dars xulosalari ushbu guruhga yuboriladi.\n` +
          `<i>(Aloqani uzish uchun: /disconnect@${escapeHtml(botUser)} yoki /unlink@${escapeHtml(botUser)})</i>`,
        );
      } else {
        return ctx.replyWithHTML(
          `❌ <b>Bog'lashda xatolik:</b> ${escapeHtml(result.error ?? 'Guruh topilmadi')}\n\n` +
          `Guruhni ulash uchun quyidagicha yuboring:\n` +
          `📌 <code>/connect@${escapeHtml(botUser)} &lt;guruh_id_yoki_nomi&gt;</code>`,
        );
      }
    }
    const current = await getLinkedGroupForChat(chatId);
    if (current) {
      return ctx.replyWithHTML(
        `ℹ️ <b>Ushbu chat allaqachon bog'langan!</b>\n\n` +
        `📚 <b>Guruh:</b> ${escapeHtml(current.name)}\n` +
        `📖 <b>Kurs:</b> ${escapeHtml(current.course?.title ?? '—')}\n` +
        `🔌 Aloqani uzish uchun: /disconnect@${escapeHtml(botUser)}`,
      );
    }
    return ctx.replyWithHTML(
      `👋 <b>Assalomu alaykum!</b>\n\n` +
      `Ushbu Telegram guruhini Golden Study CRM guruhi bilan bog'lash uchun:\n` +
      `📌 <code>/connect@${escapeHtml(botUser)} &lt;Guruh_ID yoki nomi&gt;</code> buyrug'ini yuboring.`,
    );
  }

  // Private chat: check if user passed a group deep-link parameter, e.g. /start group_<id>
  const privateText = ctx.message && 'text' in ctx.message ? ctx.message.text.trim() : '';
  const privatePayload =
    (ctx as any).startPayload ||
    (privateText.includes(' ') ? privateText.split(/\s+/).slice(1).join(' ') : '') ||
    (privateText.startsWith('/start=') ? privateText.replace(/^\/start=/, '') : '');

  const cleanGroupQuery = privatePayload ? extractCleanGroupId(privatePayload) : '';
  if (cleanGroupQuery) {
    let targetGroup = await prisma.group.findUnique({ where: { id: cleanGroupQuery } }).catch(() => null);
    if (!targetGroup) {
      targetGroup = await prisma.group.findFirst({
        where: { name: { equals: cleanGroupQuery, mode: 'insensitive' } },
      });
    }
    const groupLabel = targetGroup ? `“${targetGroup.name}”` : 'o‘quv guruhi';
    const botUser = ctx.botInfo?.username || process.env.TELEGRAM_BOT_USERNAME || 'Golden_StudyBot';
    const targetId = targetGroup ? targetGroup.id : cleanGroupQuery;
    return ctx.replyWithHTML(
      `ℹ️ <b>Guruhni ulash bo‘yicha ko‘rsatma</b>\n\n` +
      `Siz ${escapeHtml(groupLabel)}ni Telegram guruhiga ulamoqchisiz.\n\n` +
      `Guruhni ulash tartibi:\n` +
      `1️⃣ Botni o‘quv guruhingizga Administrator (admin) sifatida qo‘shing.\n` +
      `2️⃣ Guruh ichida <code>/connect@${escapeHtml(botUser)} ${escapeHtml(targetId)}</code> buyrug‘ini yuboring.\n\n` +
      `<i>Quyidagi tugma orqali botni bevosita guruhga qo‘shishingiz mumkin:</i>`,
      Markup.inlineKeyboard([
        [Markup.button.url('👥 Guruhga qo‘shish', `https://t.me/${botUser}?startgroup=group_${targetId}`)],
      ]),
    );
  }

  const activeLink = await getActiveLink(chatId);

  if (activeLink) {
    const studentName = `${activeLink.student.lastName} ${activeLink.student.firstName}`;
    const sn = escapeHtml(studentName);
    const code = escapeHtml(activeLink.student.studentCode);
    return sendRichSafe(ctx, [
      { type: 'heading', text: '✨ Xush kelibsiz!', size: 3 },
      {
        type: 'paragraph',
        text: [
          { type: 'bold', text: `O'quvchi:` }, ` ${studentName}`,
          `\nKod: ${activeLink.student.studentCode}`,
          `\n\n📌 Kerakli bo'limni tanlang:`,
        ],
      },
    ], `✨ <b>Xush kelibsiz!</b>\n\n🎓 <b>O'quvchi:</b> ${sn} (<code>${code}</code>)\n\n📌 <b>Kerakli bo'limni tanlang:</b>`);
  }

  const pendingLink = await prisma.telegramLink.findFirst({
    where: { telegramChatId: chatId, status: 'PENDING' },
    include: { student: true },
  });

  if (pendingLink) {
    const sn = escapeHtml(`${pendingLink.student.lastName} ${pendingLink.student.firstName}`);
    const code = escapeHtml(pendingLink.student.studentCode);
    return sendRichSafe(ctx, [
      { type: 'heading', text: '⏳ So\'rovingiz ko\'rib chiqilmoqda', size: 3 },
      {
        type: 'paragraph',
        text: [
          { type: 'bold', text: `O'quvchi:` }, ` ${pendingLink.student.lastName} ${pendingLink.student.firstName} (${pendingLink.student.studentCode})`,
          `\nHolat: Administrator tasdiqlashi kutilmoqda.`,
          `\n\nTasdiqlangach, bot imkoniyatlari avtomatik faollashadi.`,
        ],
      },
    ], `⏳ <b>So'rovingiz ko'rib chiqilmoqda</b>\n\n🎓 <b>O'quvchi:</b> ${sn} (<code>${code}</code>)\n📝 <b>Holat:</b> Administrator tasdiqlashi kutilmoqda.\n\n🔔 <i>Tasdiqlangach, bot imkoniyatlari avtomatik faollashadi.</i>`);
  }

  return sendRichSafe(ctx, [
    { type: 'heading', text: '👋 Assalomu alaykum!', size: 3 },
    { type: 'paragraph', text: 'Golden Study o\'quv markazining rasmiy botiga xush kelibsiz!' },
    {
      type: 'list',
      items: [
        { blocks: [{ type: 'paragraph', text: '📊 Davomatni kuzatish' }] },
        { blocks: [{ type: 'paragraph', text: '💳 To\'lovlar va balans' }] },
        { blocks: [{ type: 'paragraph', text: '📝 Uy vazifalari' }] },
        { blocks: [{ type: 'paragraph', text: '🎯 Imtihon natijalari va reyting' }] },
      ],
    },
    { type: 'divider' },
    { type: 'paragraph', text: '🔑 Davom etish uchun farzandingizning o\'quvchi kodini kiriting:' },
    { type: 'footer', text: 'Masalan: ST101' },
  ], `<b>Assalomu alaykum!</b>\n<b>Golden Study</b> o'quv markazining rasmiy botiga xush kelibsiz!\n\n• 📱 <b>Bu bot orqali farzandingizning:</b>\n• 📊 Davomatini kuzatishingiz\n• 💳 To'lovlar va balansingizni ko'rishingiz\n• 📝 Uy vazifalari bajarilganini bilishingiz\n• 🎯 Imtihon natijalari va reytingni kuzatishingiz mumkin.\n\n🔑 <b>Davom etish uchun farzandingizning o'quvchi kodini kiriting:</b>\n📌 <i>Masalan:</i> <code>ST101</code>`);
}

bot.start(handleStartOrGroupStart);
bot.command('startgroup', handleStartOrGroupStart);

bot.command(['connect', 'link'], async (ctx) => {
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
  const chatId = String(ctx.chat.id);
  const text = (ctx.message && 'text' in ctx.message ? ctx.message.text : '').trim();
  const query = text.split(/\s+/).slice(1).join(' ').trim();
  const botUser = ctx.botInfo?.username || process.env.TELEGRAM_BOT_USERNAME || 'Golden_StudyBot';

  if (!isGroup) {
    const cleanId = query ? extractCleanGroupId(query) : '';
    const connectCmd = cleanId ? `/connect@${botUser} ${cleanId}` : `/connect@${botUser} <guruh_id>`;
    return ctx.replyWithHTML(
      `⚠️ <b>Guruh chatida ishlatiladi!</b>\n\n` +
      `Ushbu buyruqni Telegram guruh chatida ishga tushiring:\n` +
      `1. Botni o'quv guruhingizga Administrator (admin) sifatida qo'shing\n` +
      `2. Guruhda <code>${connectCmd}</code> buyrug'ini yuboring.`,
      cleanId
        ? Markup.inlineKeyboard([
            [Markup.button.url('👥 Guruhga qo‘shish', `https://t.me/${botUser}?startgroup=group_${cleanId}`)],
          ])
        : undefined,
    );
  }

  if (!query) {
    return ctx.replyWithHTML(
      `⚠️ <b>Guruh ID yoki nomini kiriting!</b>\n\n` +
      `Masalan: <code>/connect@${escapeHtml(botUser)} 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d</code> yoki <code>/connect@${escapeHtml(botUser)} IELTS Intensive</code>`,
    );
  }

  const result = await connectGroupToChat(chatId, ctx.chat.title || 'Telegram Guruh', query);
  if (result.ok && result.group) {
    return ctx.replyWithHTML(
      `✅ <b>Guruh muvaffaqiyatli bog'landi!</b>\n\n` +
      `📚 <b>Guruh:</b> ${escapeHtml(result.group.name)}\n` +
      `📖 <b>Kurs:</b> ${escapeHtml(result.group.course?.title ?? '—')}\n` +
      `👨‍🏫 <b>O'qituvchi:</b> ${escapeHtml(`${result.group.teacher?.firstName ?? ''} ${result.group.teacher?.lastName ?? ''}`.trim())}\n` +
      `👥 <b>Chat:</b> ${escapeHtml(ctx.chat.title || '')}\n\n` +
      `Endi dars xulosalari va uy vazifalari ushbu guruhga yuboriladi.\n` +
      `<i>(Aloqani uzish: /disconnect@${escapeHtml(botUser)})</i>`,
    );
  }

  return ctx.replyWithHTML(
    `❌ <b>Guruh topilmadi</b>\n\n` +
    `${escapeHtml(result.error ?? 'Guruh topilmadi')}.\n\n` +
    `💡 <i>Kodni qayta tekshirib ko‘ring yoki CRM dan to‘g‘ri guruh ID sini oling.</i>`,
  );
});

bot.command(['disconnect', 'unlink'], async (ctx) => {
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
  const chatId = String(ctx.chat.id);

  if (!isGroup) {
    return ctx.replyWithHTML('⚠️ Ushbu buyruq faqat guruh chatlarida ishlatiladi.');
  }

  const result = await disconnectGroupFromChat(chatId);
  if (result.ok && result.group) {
    return ctx.replyWithHTML(
      `🔌 <b>Guruh aloqasi uzildi</b>\n\n` +
      `“<b>${escapeHtml(result.group.name)}</b>” guruhi ushbu Telegram chatidan muvaffaqiyatli ajratildi.`,
    );
  }

  return ctx.replyWithHTML(`ℹ️ ${escapeHtml(result.error ?? 'Guruh topilmadi')}`);
});

bot.command(['group_status', 'gstatus'], async (ctx) => {
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
  const chatId = String(ctx.chat.id);
  const botUser = ctx.botInfo?.username || process.env.TELEGRAM_BOT_USERNAME || 'Golden_StudyBot';

  if (!isGroup) {
    return ctx.replyWithHTML('⚠️ Ushbu buyruq faqat guruh chatlarida ishlatiladi.');
  }

  const linked = await getLinkedGroupForChat(chatId);
  if (!linked) {
    return ctx.replyWithHTML(
      `ℹ️ <b>Ushbu chat tizimga ulanmagan</b>\n\n` +
      `Guruhni ulash uchun: <code>/connect@${escapeHtml(botUser)} &lt;guruh_id&gt;</code>`,
    );
  }

  return ctx.replyWithHTML(
    `📋 <b>Bog'langan guruh:</b>\n\n` +
    `📚 <b>Nomi:</b> ${escapeHtml(linked.name)}\n` +
    `📖 <b>Kurs:</b> ${escapeHtml(linked.course?.title ?? '—')}\n` +
    `👨‍🏫 <b>O'qituvchi:</b> ${escapeHtml(`${linked.teacher?.firstName ?? ''} ${linked.teacher?.lastName ?? ''}`.trim())}\n` +
    `🆔 <b>ID:</b> <code>${escapeHtml(linked.id)}</code>\n\n` +
    `🔌 Aloqani uzish uchun: /disconnect@${escapeHtml(botUser)}`,
  );
});

bot.on('new_chat_members', async (ctx, next) => {
  const addedMe = ctx.message.new_chat_members.some((m) => m.is_bot && m.id === ctx.botInfo?.id);
  if (addedMe) {
    const botUser = ctx.botInfo?.username || process.env.TELEGRAM_BOT_USERNAME || 'Golden_StudyBot';
    return ctx.replyWithHTML(
      `👋 <b>Assalomu alaykum!</b>\n\n` +
      `Golden Study o'quv markazining rasmiy botini guruhga qo'shganingiz uchun rahmat!\n\n` +
      `⚠️ <b>Eslatma:</b> Bot xabarlarni to‘liq qabul qilishi va dars xulosalarini yuborishi uchun uni guruhda <b>Administrator (admin)</b> qiling.\n\n` +
      `Ushbu Telegram guruhini CRM tizimidagi guruh bilan bog'lash uchun quyidagi buyruqni yuboring:\n` +
      `📌 <code>/connect@${escapeHtml(botUser)} &lt;guruh_id&gt;</code>\n\n` +
      `Masalan: <code>/connect@${escapeHtml(botUser)} IELTS Intensive</code>`,
    );
  }
  return next();
});

// Menu: Davomat
bot.hears('📊 Davomat', async (ctx) => {
  const chatId = String(ctx.chat.id);
  const link = await getActiveLink(chatId);
  if (!link) {
    return ctx.reply("⚠️ Hisobingiz hali tasdiqlanmagan. Administrator tasdiqlashini kuting.");
  }

  const studentId = link.studentId;
  const attendanceList = await prisma.attendance.findMany({
    where: { studentId, isReversed: false },
    orderBy: { date: 'desc' },
    take: 10,
  });

  const cameCount = attendanceList.filter((a) => a.status === 'CAME').length;
  const excusedCount = attendanceList.filter((a) => a.status === 'EXCUSED').length;
  const absentCount = attendanceList.filter((a) => a.status === 'ABSENT').length;
  const studentName = `${link.student.lastName} ${link.student.firstName}`;

  const blocks: InputRichBlock[] = [
    { type: 'heading', text: '📊 Davomat', size: 3 },
    {
      type: 'paragraph',
      text: [
        { type: 'bold', text: studentName },
        `\n✅ Kelgan: `, { type: 'bold', text: `${cameCount}` }, ' ta',
        `\n🟡 Sababli: `, { type: 'bold', text: `${excusedCount}` }, ' ta',
        `\n❌ Sababsiz: `, { type: 'bold', text: `${absentCount}` }, ' ta',
      ],
    },
    { type: 'divider' },
  ];

  if (attendanceList.length > 0) {
    const rows = attendanceList.map((a) => {
      const rating = a.rating ?? computeSmartAverage(a.homeworkScore, a.topicScore, a.dictionaryScore);
      return [
        { text: formatDateUz(a.date) },
        { text: a.status === 'CAME' ? '✅' : a.status === 'EXCUSED' ? '🟡' : '❌' },
        { text: a.status === 'CAME' ? (typeof rating === 'number' ? `${rating}%` : '—') : '—' },
      ];
    });

    blocks.push({
      type: 'table',
      is_bordered: true,
      is_striped: true,
      cells: [
        [{ text: 'Sana', is_header: true }, { text: 'Holat', is_header: true }, { text: 'Baho', is_header: true }],
        ...rows,
      ],
    });

    blocks.push({
      type: 'details',
      summary: '📅 Oxirgi darslar',
      blocks: attendanceList.map((a) => {
        if (a.status === 'CAME') {
          const rating = a.rating ?? computeSmartAverage(a.homeworkScore, a.topicScore, a.dictionaryScore);
          const ratingStr = typeof rating === 'number' ? `Baho: ${rating}%` : 'Baholanmagan';
          const breakdown = formatScoresBreakdown(a.homeworkScore, a.topicScore, a.dictionaryScore);
          return {
            type: 'paragraph' as const,
            text: `✅ ${formatDateUz(a.date)} — ${ratingStr}${breakdown ? ` ${breakdown}` : ''}`,
          };
        }
        return {
          type: 'paragraph' as const,
          text: `${a.status === 'EXCUSED' ? '🟡 Sababli' : '❌ Sababsiz'} ${formatDateUz(a.date)}`,
        };
      }),
    });
  }

  blocks.push({ type: 'footer', text: "So'nggi 10 ta dars" });

  let fallbackHtml = `<b>Davomat hisoboti</b>\n🎓 <b>O'quvchi:</b> ${escapeHtml(studentName)}\n\n`;
  fallbackHtml += `✅ Kelgan: <b>${cameCount}</b> ta\n🟡 Sababli: <b>${excusedCount}</b> ta\n❌ Sababsiz: <b>${absentCount}</b> ta\n\n`;
  if (attendanceList.length > 0) {
    fallbackHtml += `<blockquote expandable><b>📅 Oxirgi darslar:</b>\n`;
    attendanceList.forEach((a) => {
      if (a.status === 'CAME') {
        const rating = a.rating ?? computeSmartAverage(a.homeworkScore, a.topicScore, a.dictionaryScore);
        const ratingStr = typeof rating === 'number' ? `<b>${rating}%</b>` : 'Baholanmagan';
        const breakdown = formatScoresBreakdown(a.homeworkScore, a.topicScore, a.dictionaryScore);
        fallbackHtml += `✅ <b>${formatDateUz(a.date)}</b> — ${ratingStr}${breakdown ? ` ${escapeHtml(breakdown)}` : ''}\n`;
      } else {
        fallbackHtml += `${a.status === 'EXCUSED' ? '🟡' : '❌'} <b>${formatDateUz(a.date)}</b> — ${a.status === 'EXCUSED' ? 'Sababli' : 'Sababsiz'}\n`;
      }
    });
    fallbackHtml += `</blockquote>`;
  }

  return sendRichSafe(ctx, blocks, fallbackHtml);
});

// Menu: To'lovlar
bot.hears('💳 To\'lovlar', async (ctx) => {
  const chatId = String(ctx.chat.id);
  const link = await getActiveLink(chatId);
  if (!link) {
    return ctx.reply("⚠️ Hisobingiz hali tasdiqlanmagan.");
  }

  const studentId = link.studentId;
  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: { studentId },
  });

  let balanceUzs = 0;
  ledgerEntries.forEach((entry) => {
    if (entry.direction === 'CREDIT') balanceUzs += entry.amountUzs;
    if (entry.direction === 'DEBIT') balanceUzs -= entry.amountUzs;
  });

  const payments = await prisma.payment.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const studentName = `${link.student.lastName} ${link.student.firstName}`;
  const balanceBlock = balanceUzs < 0
    ? { type: 'spoiler' as const, text: formatMoney(balanceUzs) }
    : { type: 'bold' as const, text: formatMoney(balanceUzs) };

  const blocks: InputRichBlock[] = [
    { type: 'heading', text: '💳 To\'lovlar', size: 3 },
    {
      type: 'paragraph',
      text: [
        { type: 'bold', text: studentName },
        `\n💵 Joriy balans: `, balanceBlock, ' UZS',
        balanceUzs < 0 ? `\n⚠️ Qarzdorlik: ${formatMoney(Math.abs(balanceUzs))} UZS` : '\n✅ Qarzdorlik yo\'q',
      ],
    },
    { type: 'divider' },
  ];

  if (payments.length > 0) {
    const rows = payments.map(p => [
      { text: formatDateUz(p.createdAt) },
      { text: `${formatMoney(p.amountUzs)} UZS` },
      { text: p.method },
    ]);

    blocks.push({
      type: 'table',
      is_bordered: true,
      is_striped: true,
      cells: [
        [{ text: 'Sana', is_header: true }, { text: 'Summa', is_header: true }, { text: 'Usul', is_header: true }],
        ...rows,
      ],
    });

    blocks.push({
      type: 'details',
      summary: '📜 To\'liq tarix',
      blocks: [{
        type: 'paragraph',
        text: `Jami to'lovlar: ${payments.length} ta`,
      }],
    });
  }

  blocks.push({
    type: 'footer',
    text: `Jami: ${formatMoney(payments.reduce((s, p) => s + p.amountUzs, 0))} UZS`,
  });

  let fallbackHtml = `<b>To'lovlar va balans</b>\n🎓 <b>O'quvchi:</b> ${escapeHtml(studentName)}\n\n`;
  fallbackHtml += `💵 <b>Joriy balans:</b> <code>${escapeHtml(formatMoney(balanceUzs))} UZS</code>\n`;
  fallbackHtml += balanceUzs < 0
    ? `⚠️ <b>Qarzdorlik:</b> <code>${escapeHtml(formatMoney(Math.abs(balanceUzs)))} UZS</code>`
    : `✅ <b>Qarzdorlik yo'q</b>`;
  if (payments.length > 0) {
    fallbackHtml += `\n\n<blockquote expandable><b>📜 Oxirgi to'lovlar:</b>\n`;
    payments.forEach((p) => {
      fallbackHtml += `• 🔹 <b>${formatDateUz(p.createdAt)}</b>: <code>${escapeHtml(formatMoney(p.amountUzs))} UZS</code> (${escapeHtml(p.method)})\n`;
    });
    fallbackHtml += `</blockquote>`;
  }

  return sendRichSafe(ctx, blocks, fallbackHtml);
});

// Menu: Uy vazifalari
bot.hears('📝 Uy vazifalari', async (ctx) => {
  const chatId = String(ctx.chat.id);
  const link = await getActiveLink(chatId);
  if (!link) return ctx.reply("⚠️ Hisobingiz hali tasdiqlanmagan.");

  const student = await prisma.student.findUnique({
    where: { id: link.studentId },
    include: {
      groups: {
        where: {
          status: 'ACTIVE',
          group: { status: 'ACTIVE' },
        },
        include: {
          group: true,
        },
      },
    },
  });

  const activeGroups = student?.groups ?? [];
  const upcomingLessons = (
    await Promise.all(
      activeGroups.map(async (ag) => {
        return prisma.groupLesson.findFirst({
          where: {
            groupId: ag.groupId,
            homeworkText: { not: '' },
          },
          orderBy: { date: 'desc' },
          include: { group: true },
        });
      }),
    )
  ).filter((l): l is NonNullable<typeof l> => Boolean(l));

  const attendanceList = await prisma.attendance.findMany({
    where: { studentId: link.studentId, isReversed: false },
    orderBy: { date: 'desc' },
    take: 7,
  });

  const studentName = `${link.student.lastName} ${link.student.firstName}`;
  const blocks: InputRichBlock[] = [
    { type: 'heading', text: '📝 Uy vazifalari', size: 3 },
    { type: 'paragraph', text: [{ type: 'bold', text: studentName }] },
  ];

  if (upcomingLessons.length > 0) {
    blocks.push({ type: 'heading', text: '📌 Keyingi darsga vazifa', size: 4 });
    upcomingLessons.forEach((l) => {
      const plan = parseLessonPlan(l.homeworkText);
      const textParts: RichText[] = [
        bold(`📚 Guruh: ${l.group.name} (${formatDateUz(l.date)})`),
      ];
      if (plan.topic) {
        textParts.push(`\n📘 Mavzu: ${plan.topic}`);
      }
      if (plan.homeworkText) {
        textParts.push(`\n📝 Vazifa: ${plan.homeworkText}`);
      }
      blocks.push({
        type: 'paragraph',
        text: textParts,
      });
    });
    blocks.push({ type: 'divider' });
  } else {
    blocks.push({ type: 'heading', text: '📌 Keyingi darsga vazifa', size: 4 });
    blocks.push({ type: 'paragraph', text: 'Hozircha yangi uy vazifasi kiritilmagan.' });
    blocks.push({ type: 'divider' });
  }

  if (attendanceList.length > 0) {
    blocks.push({ type: 'heading', text: '📊 Oxirgi darslardagi baholar', size: 4 });
    blocks.push({
      type: 'list',
      items: attendanceList.map((a) => {
        if (a.status === 'CAME') {
          const rating = a.rating ?? computeSmartAverage(a.homeworkScore, a.topicScore, a.dictionaryScore) ?? 0;
          const breakdown = formatScoresBreakdown(a.homeworkScore, a.topicScore, a.dictionaryScore);
          return {
            has_checkbox: true,
            is_checked: (a.homeworkScore ?? 0) > 0,
            blocks: [{
              type: 'paragraph',
              text: `${formatDateUz(a.date)} — Baho: ${rating}%${breakdown ? `\n${breakdown}` : ''}`,
            }],
          };
        }
        return {
          has_checkbox: false,
          blocks: [{
            type: 'paragraph',
            text: `${formatDateUz(a.date)} — ${a.status === 'EXCUSED' ? '🟡 Sababli' : '❌ Sababsiz'}`,
          }],
        };
      }),
    });

    const cameList = attendanceList.filter((a) => a.status === 'CAME');
    const avgRating = cameList.length > 0
      ? Math.round(
          cameList.reduce(
            (s, a) =>
              s +
              (a.rating ??
                computeSmartAverage(a.homeworkScore, a.topicScore, a.dictionaryScore) ??
                0),
            0,
          ) / cameList.length,
        )
      : 0;

    blocks.push(
      { type: 'divider' },
      { type: 'paragraph', text: `O‘rtacha baho: ${avgRating}% (${cameList.length} ta dars)` },
    );
  } else if (upcomingLessons.length === 0) {
    blocks.push({ type: 'paragraph', text: "Ma'lumotlar topilmadi." });
  }

  let fallbackHtml = `<b>Uy vazifalari va baholar</b>\n🎓 <b>O'quvchi:</b> ${escapeHtml(studentName)}\n\n`;
  if (upcomingLessons.length > 0) {
    fallbackHtml += `<b>📌 Keyingi darsga vazifa:</b>\n`;
    upcomingLessons.forEach((l) => {
      const plan = parseLessonPlan(l.homeworkText);
      fallbackHtml += `📚 <b>Guruh:</b> ${escapeHtml(l.group.name)} (<i>${formatDateUz(l.date)}</i>)\n`;
      if (plan.topic) {
        fallbackHtml += `📘 <b>Mavzu:</b> ${escapeHtml(plan.topic)}\n`;
      }
      if (plan.homeworkText) {
        fallbackHtml += `📝 <b>Vazifa:</b> ${escapeHtml(plan.homeworkText)}\n`;
      }
      fallbackHtml += `\n`;
    });
  } else {
    fallbackHtml += `<b>📌 Keyingi darsga vazifa:</b>\n<i>Hozircha yangi uy vazifasi kiritilmagan.</i>\n\n`;
  }

  if (attendanceList.length > 0) {
    fallbackHtml += `<blockquote expandable><b>📊 Oxirgi darslardagi baholar:</b>\n`;
    attendanceList.forEach((a) => {
      if (a.status === 'CAME') {
        const rating = a.rating ?? computeSmartAverage(a.homeworkScore, a.topicScore, a.dictionaryScore) ?? 0;
        const breakdown = formatScoresBreakdown(a.homeworkScore, a.topicScore, a.dictionaryScore);
        fallbackHtml += `✅ <b>${formatDateUz(a.date)}</b> — <b>Baho: ${rating}%</b> ${breakdown ? `${escapeHtml(breakdown)}` : ''}\n`;
      } else if (a.status === 'EXCUSED') {
        fallbackHtml += `🟡 <b>${formatDateUz(a.date)}</b> — Sababli\n`;
      } else {
        fallbackHtml += `❌ <b>${formatDateUz(a.date)}</b> — Sababsiz\n`;
      }
    });
    fallbackHtml += `</blockquote>`;
    const cameList = attendanceList.filter((a) => a.status === 'CAME');
    const avgRating = cameList.length > 0
      ? Math.round(
          cameList.reduce(
            (s, a) =>
              s +
              (a.rating ??
                computeSmartAverage(a.homeworkScore, a.topicScore, a.dictionaryScore) ??
                0),
            0,
          ) / cameList.length,
        )
      : 0;
    fallbackHtml += `\n📈 <b>O‘rtacha baho:</b> ${avgRating}% (${cameList.length} ta dars)\n`;
  } else if (upcomingLessons.length === 0) {
    fallbackHtml += `<i>Ma'lumotlar topilmadi.</i>`;
  }

  return sendRichSafe(ctx, blocks, fallbackHtml);
});

// Menu: Reyting
bot.hears('⭐ Reyting', async (ctx) => {
  const chatId = String(ctx.chat.id);
  const link = await getActiveLink(chatId);
  if (!link) return ctx.reply("⚠️ Hisobingiz hali tasdiqlanmagan.");

  const ratingInfo = await getStudentRating(link.studentId);
  const studentName = `${link.student.lastName} ${link.student.firstName}`;

  if (!ratingInfo || !ratingInfo.myRow) {
    return sendRichSafe(ctx, [
      { type: 'heading', text: '⭐ Reyting nimadir topilmadi', size: 3 },
      { type: 'paragraph', text: `${bold('O\'quvchi:')} ${studentName}\n\nReyting ma'lumotlari topilmadi.` },
    ], `<b>Akademik reyting</b>\n🎓 <b>O'quvchi:</b> ${escapeHtml(studentName)}\n\n<i>Reyting ma'lumotlari topilmadi.</i>`);
  }

  const { rank, totalStudents, myRow, topList, groupName } = ratingInfo;

  const slides: InputRichBlock[] = [];

  slides.push({
    type: 'paragraph',
    text: [
      bold('⭐ Reyting'),
      '\n', bold(studentName),
      `\n🏆 O'rin: #${rank} / ${totalStudents}`,
      `\n📈 Davomat bahosi: ${myRow.attendanceRating}%`,
      `\n📊 Umumiy ball: ${myRow.totalScore} / 100`,
      `\n📚 ${escapeHtml(groupName)}`,
    ],
  });

  slides.push(
    { type: 'heading', text: '📊 Tahlil', size: 4 },
    { type: 'table', is_bordered: true, is_striped: true, cells: [
      [{ text: "Ko'rsatkich", is_header: true }, { text: 'Natija', is_header: true }],
      [{ text: 'Imtihon %' }, { text: `${myRow.averagePercent}% (${myRow.examsCount} ta)` }],
      [{ text: 'Davomat' }, { text: `${myRow.attendanceRating}%` }],
      [{ text: 'Uy vazifasi' }, { text: `${myRow.homeworkRate}%` }],
    ] },
  );

  slides.push(
    { type: 'heading', text: '🏆 Leaderboard', size: 4 },
    { type: 'table', is_bordered: true, is_striped: true, cells: [
      [{ text: '#', is_header: true }, { text: 'Ism', is_header: true }, { text: 'Ball', is_header: true }, { text: 'Baho', is_header: true }],
      ...topList.map((item, i) => {
        const isMe = item.studentId === link.studentId;
        return [
          { text: `#${i + 1}` },
          { text: isMe ? `${item.studentName} 👈` : item.studentName },
          { text: `${item.totalScore}` },
          { text: `${item.attendanceRating}%` },
        ];
      }),
    ] },
  );

  let fallbackHtml = `<b>Akademik reyting</b>\n🎓 <b>O'quvchi:</b> ${escapeHtml(studentName)}\n\n`;
  fallbackHtml += `🏆 <b>Guruhdagi o'rni:</b> <b>#${rank}</b> / ${totalStudents} o'quvchi\n`;
  fallbackHtml += `📊 <b>Umumiy ball:</b> <b>${myRow.totalScore}</b> / 100 ball\n`;
  fallbackHtml += `📈 <b>Davomat bahosi:</b> ${myRow.attendanceRating}%\n`;
  fallbackHtml += `📚 <b>Guruh:</b> ${escapeHtml(groupName)}\n\n`;
  fallbackHtml += `<blockquote expandable><b>📜 Guruh Leaderboard (Top-5):</b>\n`;
  topList.forEach((item) => {
    const name = escapeHtml(item.studentName);
    const isMe = item.studentId === link.studentId ? ' 👈 (Siz)' : '';
    fallbackHtml += `#${topList.indexOf(item) + 1} <b>${name}</b> — <b>${item.totalScore} ball</b> (${item.attendanceRating}%)${isMe}\n`;
  });
  fallbackHtml += `</blockquote>`;

  return sendRichSafe(ctx, slides, fallbackHtml);
});

// Menu: Imtihonlar
bot.hears('🎯 Imtihonlar', async (ctx) => {
  const chatId = String(ctx.chat.id);
  const link = await getActiveLink(chatId);
  if (!link) return ctx.reply("⚠️ Hisobingiz hali tasdiqlanmagan.");

  const examResults = await prisma.examResult.findMany({
    where: { studentId: link.studentId },
    include: {
      exam: {
        include: { group: true },
      },
    },
    orderBy: { exam: { date: 'desc' } },
    take: 5,
  });

  const studentName = `${link.student.lastName} ${link.student.firstName}`;

  const slides: InputRichBlock[] = [];

  if (examResults.length === 0) {
    slides.push({ type: 'paragraph', text: "🎯 Hali imtihon natijalari e'lon qilinmagan." });
  } else {
    examResults.forEach(res => {
      slides.push(
        { type: 'heading', text: `🎯 ${res.exam.name}`, size: 3 },
        {
          type: 'paragraph',
          text: [
            `📅 ${formatDateUz(res.exam.date)}`,
            `\nNatija: `, { type: 'bold', text: `${res.score} / ${res.exam.maxScore}` }, ' ball',
            `\nO'rin: `, { type: 'bold', text: `#${res.rank}` },
          ],
        },
        { type: 'divider' },
      );
    });
  }

  let fallbackHtml = `<b>Imtihon natijalari</b>\n🎓 <b>O'quvchi:</b> ${escapeHtml(studentName)}\n\n`;
  if (examResults.length > 0) {
    fallbackHtml += `<blockquote expandable><b>📊 Oxirgi imtihonlar:</b>\n`;
    examResults.forEach((res) => {
      fallbackHtml += `📌 <b>${escapeHtml(res.exam.name)}</b> (${formatDateUz(res.exam.date)})\n`;
      fallbackHtml += `  • Natija: <b>${res.score}</b> / ${res.exam.maxScore} ball\n`;
      fallbackHtml += `  • O'rni: <b>${res.rank}</b>-o'rin\n`;
    });
    fallbackHtml += `</blockquote>`;
  } else {
    fallbackHtml += `<i>Hali imtihon natijalari e'lon qilinmagan.</i>`;
  }
  return sendRichSafe(ctx, slides, fallbackHtml);
});

// Text listener for Student Code submission
bot.on('text', async (ctx, next) => {
  if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') return next();
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return next();

  const chatId = String(ctx.chat.id);
  const activeLink = await getActiveLink(chatId);
  if (activeLink) return next();

  const codeMatch = text.toUpperCase().match(/^ST\d+$/i);
  if (!codeMatch) {
    return ctx.replyWithHTML(
      `⚠️ <b>Noma'lum buyruq</b>\n\nFarzandingizning o'quvchi kodini kiriting:\n📌 <i>Masalan:</i> <code>ST101</code>`
    );
  }

  const studentCode = text.toUpperCase();
  const student = await prisma.student.findUnique({
    where: { studentCode },
  });

  if (!student) {
    return ctx.replyWithHTML(
      `❌ <b>O'quvchi kodi topilmadi</b>\n\n<code>${escapeHtml(studentCode)}</code> kodli o'quvchi tizimda mavjud emas.\n\n💡 <i>Kodni qayta tekshirib kiriting (masalan: <code>ST101</code>) yoki o'quv markazi bilan bog'laning.</i>`
    );
  }

  const existingLink = await prisma.telegramLink.findFirst({
    where: { telegramChatId: chatId, studentId: student.id },
  });

  if (existingLink) {
    await prisma.telegramLink.update({
      where: { id: existingLink.id },
      data: { status: 'PENDING' },
    });
  } else {
    await prisma.telegramLink.create({
      data: {
        telegramChatId: chatId,
        studentId: student.id,
        parentName: ctx.from.first_name || 'Ota-ona',
        parentPhone: '',
        status: 'PENDING',
      },
    });
  }

  const studentName = escapeHtml(`${student.lastName} ${student.firstName}`);
  const code = escapeHtml(student.studentCode);

  return ctx.replyWithHTML(
    `✅ <b>So'rov muvaffaqiyatli yuborildi!</b>\n\n🎓 <b>O'quvchi:</b> ${studentName}\n🆔 <b>Kod:</b> <code>${code}</code>\n⏳ <b>Holat:</b> Administrator tasdiqlashi kutilmoqda\n\n📢 <i>Markaz administratori so'rovingizni tasdiqlashi bilan sizga bildirishnoma yuboriladi.</i>`
  );
});

bot.command('test_rich', async (ctx) => {
  const tests: [string, InputRichBlock][] = [
    ['heading', { type: 'heading', text: 'Heading Test', size: 3 }],
    ['table', { type: 'table', is_bordered: true, is_striped: true,
      cells: [[{ text: 'A', is_header: true }, { text: 'B', is_header: true }], [{ text: '1' }, { text: '2' }]] }],
    ['divider', { type: 'divider' }],
    ['details', { type: 'details', summary: 'Summary',
      blocks: [{ type: 'paragraph', text: 'Hidden content' }] }],
    ['list', { type: 'list', items: [{ blocks: [{ type: 'paragraph', text: 'Item 1' }] }] }],
    ['footer', { type: 'footer', text: 'Footer text' }],
    ['pre', { type: 'pre', text: 'code block', language: 'text' }],
    ['blockquote', { type: 'blockquote', blocks: [{ type: 'paragraph', text: 'Quote' }] }],
    ['pullquote', { type: 'pullquote', text: 'Pull quote' }],
  ];
  const failed: string[] = [];
  for (const [name, block] of tests) {
    try {
      await ctx.telegram.callApi('sendRichMessage' as any, {
        chat_id: ctx.chat.id,
        rich_message: { blocks: [block] },
      });
    } catch (err: any) {
      failed.push(`${name}: ${err.description ?? err.message ?? err}`);
    }
  }
  await ctx.reply(failed.length === 0 ? '✅ All block types work!' :
    `❌ Failed (${failed.length}/${tests.length}):\n${failed.join('\n')}`);
});

if (process.env.NODE_ENV !== 'test') {
  bot.launch(() => {
    console.log('🤖 Golden Study Telegram Bot successfully started!');
  }).catch((err) => {
    console.error('❌ Failed to launch Telegram Bot:', err);
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
