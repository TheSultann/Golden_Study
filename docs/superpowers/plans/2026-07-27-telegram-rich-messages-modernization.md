# Telegram Bot Rich Messages Modernization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace `replyWithHTML` with `sendRichMessage` (Bot API 10.2) for all bot responses. ReplyKeyboard unchanged.

**Architecture:** Create `rich-message.ts` utility module with typed builders. Each handler constructs `InputRichBlock[]` array and sends via `ctx.telegram.callApi('sendRichMessage', payload)`.

**Tech Stack:** TypeScript, Telegraf 4.x (callApi), Telegram Bot API 10.2 Rich Messages.

## Global Constraints

- All responses use `ctx.telegram.callApi('sendRichMessage', ...)` NOT `ctx.replyWithHTML`
- ReplyKeyboard `mainMenu` preserved for all responses
- On `callApi` error → fallback to `ctx.replyWithHTML` with same content
- No external npm deps for rich messages — pure TS objects
- All RichText arrays can contain plain strings OR objects with `type`
- Files: `apps/bot/src/index.ts` (modify), `apps/bot/src/rich-message.ts` (create)

---

### Task 1: Rich Message Builder Utility + Type Definitions

**Files:**
- Create: `apps/bot/src/rich-message.ts`
- Modify: none yet

**Interfaces:**
- Consumes: nothing
- Produces: TS types `RichText`, `InputRichBlock`, `InputRichBlock[]`, and helper functions

- [ ] **Step 1: Create `apps/bot/src/rich-message.ts` with types and helpers**

```typescript
// RichText union — string | object | array
export type RichText =
  | string
  | {
      type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'spoiler'
        | 'code' | 'marked' | 'subscript' | 'superscript'
        | 'url' | 'mention' | 'hashtag' | 'bot_command' | 'email_address'
        | 'phone_number' | 'custom_emoji';
      text?: RichText;
      url?: string;
      username?: string;
      custom_emoji_id?: string;
      alternative_text?: string;
    }
  | RichText[];

// Block — discriminated by type field
export type InputRichBlock =
  | { type: 'paragraph'; text: RichText }
  | { type: 'heading'; text: RichText; size: number }
  | { type: 'divider' }
  | { type: 'footer'; text: RichText }
  | { type: 'pre'; text: RichText; language?: string }
  | { type: 'blockquote'; blocks: InputRichBlock[]; credit?: RichText }
  | { type: 'pullquote'; text: RichText; credit?: RichText }
  | { type: 'details'; summary: RichText; blocks: InputRichBlock[]; is_open?: boolean }
  | { type: 'list'; items: InputRichBlockListItem[] }
  | { type: 'slideshow'; blocks: InputRichBlock[]; caption?: RichBlockCaption }
  | { type: 'table'; cells: RichBlockTableCell[][]; is_bordered?: boolean; is_striped?: boolean; caption?: RichText };

export interface RichBlockTableCell {
  text?: RichText;
  is_header?: boolean;
  colspan?: number;
  rowspan?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
}

export interface InputRichBlockListItem {
  blocks: InputRichBlock[];
  has_checkbox?: boolean;
  is_checked?: boolean;
}

export interface RichBlockCaption {
  text: RichText;
  credit?: RichText;
}

// Builders
export function bold(t: RichText): RichText {
  return { type: 'bold', text: t };
}

export function italic(t: RichText): RichText {
  return { type: 'italic', text: t };
}

export function spoiler(t: RichText): RichText {
  return { type: 'spoiler', text: t };
}

export function header(text: RichText, size: number = 4): InputRichBlock {
  return { type: 'heading', text, size };
}

export function divider(): InputRichBlock {
  return { type: 'divider' };
}

export function paragraph(text: RichText): InputRichBlock {
  return { type: 'paragraph', text };
}

export function slideshow(blocks: InputRichBlock[]): InputRichBlock {
  return { type: 'slideshow', blocks };
}

export function tbl(cells: RichBlockTableCell[][], opts?: { bordered?: boolean; striped?: boolean }): InputRichBlock {
  return { type: 'table', cells, is_bordered: opts?.bordered ?? true, is_striped: opts?.striped ?? true };
}

export function details(summary: RichText, blocks: InputRichBlock[], is_open = false): InputRichBlock {
  return { type: 'details', summary, blocks, is_open };
}

export function footer(text: RichText): InputRichBlock {
  return { type: 'footer', text };
}

export function list(items: InputRichBlockListItem[]): InputRichBlock {
  return { type: 'list', items };
}
```

- [ ] **Step 2: Verify builds**

Run: `pnpm --filter @golden-study/bot typecheck`
Expected: PASS (no type errors, since no one imports it yet)

---

### Task 0: Add import + sendRichSafe helper to index.ts

**Files:**
- Modify: `apps/bot/src/index.ts` top of file + add helper function

**Interfaces:**
- Produces: `sendRichSafe(ctx, blocks, fallbackHtml)` used by all later tasks

- [ ] **Step 1: Add import to top of index.ts**

```typescript
import type { InputRichBlock } from './rich-message.js';
```

- [ ] **Step 2: Add sendRichSafe helper before bot.start()**

```typescript
async function sendRichSafe(
  ctx: any,
  blocks: InputRichBlock[],
  fallbackHtml: string,
  extra?: { reply_markup?: any }
) {
  try {
    await ctx.telegram.callApi('sendRichMessage', {
      chat_id: ctx.chat.id,
      rich_message: { blocks },
      reply_markup: extra?.reply_markup ?? mainMenu.reply_markup,
    });
  } catch (err) {
    console.error('sendRichMessage failed, falling back to HTML:', err);
    await ctx.replyWithHTML(fallbackHtml, extra?.reply_markup ?? mainMenu);
  }
}
```

---

### Task 2: Rewrite Reyting (⭐) Handler

**Files:**
- Modify: `apps/bot/src/index.ts` lines 358-397
- Uses: `richMessage.ts` builders from Task 1

**Interfaces:**
- Consumes: `bold()`, `header()`, `tbl()`, `slideshow()`, `divider()`, `paragraph()`, `details()`, `footer()`, `list()` from Task 1, `sendRichSafe()` from Task 0
- Produces: 3-slide slideshow for rating

- [ ] **Step 1: Rewrite `bot.hears('⭐ Reyting', ...)`**

Replace `ctx.replyWithHTML(...)` block with:

```typescript
import { buildRichMessage } from './rich-message.js';

// After computing ratingInfo, myRow, topList...

const slides: InputRichBlock[] = [];

// Slide 1 — Overview
slides.push({
  type: 'paragraph',
  text: [
    { type: 'bold', text: '⭐ Reyting' },
    '\n',
    { type: 'bold', text: studentName },
    '\n\n',
    `🏆 O'rin: #${rank} / ${totalStudents}`,
    '\n',
    `${'⭐'.repeat(myRow.stars)}${'☆'.repeat(5 - myRow.stars)}`,
    '\n',
    `📊 Umumiy ball: ${myRow.totalScore} / 100`,
  ],
});

// Slide 2 — Detailed breakdown table
slides.push({
  type: 'heading',
  text: '📊 Tahlil',
  size: 4,
}, {
  type: 'table',
  is_bordered: true,
  is_striped: true,
  cells: [
    [{ text: 'Ko\'rsatkich', is_header: true }, { text: 'Natija', is_header: true }],
    [{ text: 'Imtihon %' }, { text: `${myRow.averagePercent}% (${myRow.examsCount} ta)` }],
    [{ text: 'Davomat' }, { text: `${myRow.attendanceRating} / 5.0` }],
    [{ text: 'Uy vazifasi' }, { text: `${myRow.homeworkRate}%` }],
  ],
});

// Slide 3 — Leaderboard table
const leaderboardRows = topList.map((item, i) => {
  const isMe = item.studentId === link.studentId;
  return [
    { text: `#${i + 1}` },
    { text: isMe ? `${item.studentName} 👈` : item.studentName },
    { text: `${item.totalScore}` },
    { text: `${'⭐'.repeat(item.stars)}${'☆'.repeat(5 - item.stars)}` },
  ];
});
slides.push({
  type: 'heading',
  text: '🏆 Leaderboard',
  size: 4,
}, {
  type: 'table',
  is_bordered: true,
  is_striped: true,
  cells: [
    [{ text: '#', is_header: true }, { text: 'Ism', is_header: true }, { text: 'Ball', is_header: true }, { text: 'Yulduz', is_header: true }],
    ...leaderboardRows,
  ],
});

await sendRichSafe(ctx, [slideshow(slides)], getFallbackHtml(/*...*/));
```

- [ ] **Step 2: Build and check types**

Run: `pnpm --filter @golden-study/bot typecheck`

---

### Task 3: Rewrite Davomat (📊) Handler

**Files:**
- Modify: `apps/bot/src/index.ts` lines 238-277

- [ ] **Step 1: Rewrite `bot.hears('📊 Davomat', ...)`**

Use `header()`, `bold()`, `paragraph()`, `divider()`, `tbl()`, `details()`, `footer()` builders:

```typescript
const blocks: InputRichBlock[] = [];

blocks.push(
  header('📊 Davomat', 3),
  paragraph([
    bold(studentName),
    `\n\n✅ Kelgan: `, bold(`${cameCount}`),
    ` ta\n🟡 Sababli: `, bold(`${excusedCount}`),
    ` ta\n❌ Sababsiz: `, bold(`${absentCount}`),
    ' ta',
  ]),
  divider(),
);

if (attendanceList.length > 0) {
  const rows = attendanceList.map(a => [
    { text: formatDateUz(a.date) },
    { text: a.status === 'CAME' ? '✅' : a.status === 'EXCUSED' ? '🟡' : '❌' },
    { text: a.homeworkDone ? '✅ Bajarilgan' : '❌ Bajarilmagan' },
  ]);

  blocks.push(tbl([
    [{ text: 'Sana', is_header: true }, { text: 'Holat', is_header: true }, { text: 'DZ', is_header: true }],
    ...rows,
  ]));

  blocks.push(details('📅 Oxirgi darslar', attendanceList.map(a =>
    paragraph(`${a.status === 'CAME' ? '✅' : a.status === 'EXCUSED' ? '🟡' : '❌'} ${formatDateUz(a.date)} — ${a.homeworkDone ? '✅ Bajarilgan' : '❌ Bajarilmagan'}`)
  )));
}

blocks.push(footer("So'nggi 10 ta dars"));

await sendRichSafe(ctx, blocks, fallbackHtml);
```

- [ ] **Step 2: Build and check types**

---

### Task 4: Rewrite To'lovlar (💳) Handler

**Files:**
- Modify: `apps/bot/src/index.ts` lines 280-326

- [ ] **Step 1: Rewrite `bot.hears('💳 To\'lovlar', ...)`**

Use `header()`, `bold()`, `spoiler()`, `divider()`, `tbl()`, `details()`, `footer()` builders:

```typescript
const blocks: InputRichBlock[] = [];

blocks.push(
  header('💳 To\'lovlar', 3),
  paragraph([
    bold(studentName),
    `\n\n💵 Joriy balans: `,
    balanceUzs < 0 ? spoiler(formatMoney(balanceUzs)) : bold(formatMoney(balanceUzs)),
    ' UZS',
    balanceUzs < 0 ? `\n⚠️ Qarzdorlik: ${formatMoney(Math.abs(balanceUzs))} UZS` : '\n✅ Qarzdorlik yo\'q',
  ]),
  divider(),
);

if (payments.length > 0) {
  const rows = payments.map(p => [
    { text: formatDateUz(p.createdAt) },
    { text: `${formatMoney(p.amountUzs)} UZS` },
    { text: p.method },
  ]);

  blocks.push(tbl([
    [{ text: 'Sana', is_header: true }, { text: 'Summa', is_header: true }, { text: 'Usul', is_header: true }],
    ...rows,
  ]));

  blocks.push(details('📜 To\'liq tarix', [
    paragraph(`Jami to'lovlar: ${payments.length} ta`),
  ]));
}

blocks.push(footer(`Jami: ${formatMoney(payments.reduce((s, p) => s + p.amountUzs, 0))} UZS`));

await sendRichSafe(ctx, blocks, fallbackHtml);
```

- [ ] **Step 2: Build and check types**

---

### Task 5: Rewrite Imtihonlar (🎯) Handler

**Files:**
- Modify: `apps/bot/src/index.ts` lines 400-434

- [ ] **Step 1: Rewrite `bot.hears('🎯 Imtihonlar', ...)`**

Use `header()`, `paragraph()`, `bold()`, `divider()`, `slideshow()` builders:

```typescript
const slides: InputRichBlock[] = [];

if (examResults.length === 0) {
  slides.push(paragraph('🎯 Hali imtihon natijalari e\'lon qilinmagan.'));
} else {
  examResults.forEach(res => {
    slides.push(
      header(`🎯 ${res.exam.name}`, 3),
      paragraph([
        `📅 ${formatDateUz(res.exam.date)}`,
        `\nNatija: `, bold(`${res.score} / ${res.exam.maxScore}`), ' ball',
        `\nO'rin: `, bold(`#${res.rank}`),
      ]),
      divider(),
    );
  });
}

const payload = slides.length > 1 ? [slideshow(slides)] : slides;
await sendRichSafe(ctx, payload, fallbackHtml);
```

- [ ] **Step 2: Build and check types**

---

### Task 6: Rewrite Uy vazifalari (📝) Handler

**Files:**
- Modify: `apps/bot/src/index.ts` lines 329-356

- [ ] **Step 1: Rewrite `bot.hears('📝 Uy vazifalari', ...)`**

Use `header()`, `paragraph()`, `bold()`, `list()`, `divider()` builders:

```typescript
const blocks: InputRichBlock[] = [];

blocks.push(
  header('📝 Uy vazifalari', 3),
  paragraph(bold(studentName)),
);

if (attendanceList.length > 0) {
  const items = attendanceList.map(a => ({
    has_checkbox: true,
    is_checked: a.homeworkDone,
    blocks: [paragraph(`${formatDateUz(a.date)} — ${a.homeworkDone ? 'Bajarilgan' : 'Bajarilmagan'}`)],
  }));

  blocks.push(list(items));

  const doneCount = attendanceList.filter(a => a.homeworkDone).length;
  const pct = Math.round((doneCount / attendanceList.length) * 100);

  blocks.push(divider(), paragraph(`Bajarilgan: ${doneCount} / ${attendanceList.length} (${pct}%)`));
} else {
  blocks.push(paragraph('Ma\'lumotlar topilmadi.'));
}

await sendRichSafe(ctx, blocks, fallbackHtml);
```

- [ ] **Step 2: Build and check types**

---

### Task 7: Rewrite /start Handler

**Files:**
- Modify: `apps/bot/src/index.ts` lines 206-234

- [ ] **Step 1: Rewrite `bot.start(...)`**

Replace each `ctx.replyWithHTML(...)` call with `sendRichSafe` using structured blocks (headings, paragraphs).

- [ ] **Step 2: Build and verify**

Run: `pnpm --filter @golden-study/bot typecheck`
Run: `pnpm --filter @golden-study/bot lint`
