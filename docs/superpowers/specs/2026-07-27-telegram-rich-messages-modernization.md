# Telegram Bot — Rich Messages Modernization

## Цель

Перевести ответы бота с `replyWithHTML` на Telegram Bot API 10.2 Rich Messages. Использовать `sendRichMessage` через `ctx.telegram.callApi`. ReplyKeyboard (навигация) остаётся без изменений.

## Новые блоки Rich Messages

Доступные `InputRichBlock` типы для ответов:

- `paragraph` — текст с RichText форматированием
- `heading` — заголовок (size 1-6)
- `divider` — разделитель
- `table` — таблица (bordered, striped, cell formatting)
- `details` — раскрывающийся блок (summary + content)
- `slideshow` — горизонтальный свайп между слайдами (массив blocks)
- `list` — список с checkbox/ordered
- `blockquote` / `pullquote` — цитаты
- `footer` — подпись/сноска
- `pre` — код с подсветкой языка
- `photo` / `video` / `audio` / `animation` — медиа

RichText форматирование: bold, italic, underline, strikethrough, spoiler, code, marked, url, mention, custom_emoji.

## Дизайн ответов

### 1. Приветствие (/start)

**Если студент непривязан:**
- 1 rich message: heading + paragraph с инструкцией

**Если привязан:**
- 1 rich message: heading с именем + список доступных разделов

### 2. Reyting ⭐ — слайдшоу (3 слайда)

Слайд 1 — Обзор:
```
heading "⭐ Reyting" size 3
paragraph: bold имя студента
paragraph: "🏆 O'rin: #N / M"
paragraph: звёзды (⭐×N ☆×M)
paragraph: "📊 Umumiy ball: N / 100"
```

Слайд 2 — Детали:
```
heading "📊 Tahlil" size 4
table bordered striped:
| Ko'rsatkich | Natija |
| Imtihon %   | X%     |
| Davomat     | X / 5 |
| Uy vazifasi | X%    |
```

Слайд 3 — Лидерборд Top-5:
```
heading "🏆 Leaderboard" size 4
table bordered striped:
| # | Ism | Ball | Yulduz |
```

### 3. Davomat 📊 — 1 rich message

```
heading "📊 Davomat" size 3
paragraph: bold статистика (Kelgan X, Sababli Y, Sababsiz Z)
divider
table bordered striped (10 последних записей):
| Sana | Holat | DZ |
details summary "📅 Oxirgi darslar":
  paragraph с детальным списком
footer "So'nggi 10 ta dars"
```

### 4. To'lovlar 💳 — 1 rich message

```
heading "💳 To'lovlar" size 3
paragraph: bold баланс (спойлер если отрицательный)
divider
table bordered striped:
| Sana | Summa | Usul |
details summary "📜 To'liq tarix":
  table со всеми платежами
footer общая сумма
```

### 5. Imtihonlar 🎯 — слайдшоу (по экзамену)

Каждый слайд:
```
heading "🎯 {exam_name}" size 3
paragraph: "📅 {date}"
paragraph: "Natija: bold {score} / {maxScore}"
paragraph: "O'rin: #N"
divider
pullquote с цитатой (опционально)
```

### 6. Uy vazifalari 📝 — 1 rich message

```
heading "📝 Uy vazifalari" size 3
list с checkbox (has_checkbox + is_checked для выполненных)
  "12.03 — {status}"
  "11.03 — {status}"
divider
paragraph: "Bajarilgan: X / Y (Z%)"
```

## Техническая реализация

### Метод отправки

Вместо `ctx.replyWithHTML()` используем:

```typescript
await ctx.telegram.callApi('sendRichMessage', {
  chat_id: ctx.chat.id,
  rich_message: { blocks: [...] },
  reply_markup: mainMenu.reply_markup,
});
```

### RichText Builder

Утилита для сборки RichText:

```typescript
type RichText = string | RichTextNode | RichTextNode[];

interface RichTextNode {
  type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'spoiler'
      | 'code' | 'marked' | 'url' | 'mention' | 'custom_emoji';
  text?: RichText;
  url?: string;
  username?: string;
  custom_emoji_id?: string;
  alternative_text?: string;
}
```

### Вспомогательные функции

- `text(t)` — plain string
- `bold(t)` — { type: 'bold', text: t }
- `italic(t)` — { type: 'italic', text: t }
- `spoiler(t)` — { type: 'spoiler', text: t }
- `header(text, size)` — { type: 'heading', text, size }
- `row(cells, opts?)` — строка таблицы
- `slide(blocks)` — { type: 'slideshow', blocks }
- `divider()` — { type: 'divider' }

## Файлы

- `apps/bot/src/index.ts` — переписать handler'ы (start, davomat, to'lovlar, uy vazifalari, reyting, imtihonlar)
- `apps/bot/src/rich-message.ts` — новый, утилиты для сборки RichMessage payload

## Критерии

- Все текущие функции работают
- ReplyKeyboard сохранён
- При ошибке sendRichMessage — fallback на replyWithHTML
- Типизация payload — inline interface, без external библиотек
