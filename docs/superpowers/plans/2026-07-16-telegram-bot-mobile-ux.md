# Telegram Bot Mobile UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Исправить summary и преобразовать Telegram tables в понятные mobile-карточки без horizontal scroll.

**Architecture:** `TelegramBotPage` получает семантические wrappers и `data-label` без изменения данных/handlers. Responsive CSS управляет 2×2 summary и card layout таблиц; дублирующие информационные блоки удаляются.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library.

## Global Constraints

- Не менять contracts, repositories, mutations и бизнес-логику.
- Даты `DD.MM.YYYY`, timezone `Asia/Tashkent`.
- Browser/Playwright не запускать.
- Работать в текущем `main` без commit по разрешению пользователя.

---

### Task 1: Telegram Bot responsive UX

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/pages/TelegramBotPage.tsx`
- Modify: `apps/web/src/index.css`
- Create: `apps/web/src/telegramResponsive.test.ts`
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: `TelegramBotOverview`, `TelegramLink`, existing approve/reject/sendManual handlers.
- Produces: `.telegram-summary-content`, `data-label` table cells, responsive card/actions CSS.

- [ ] **Step 1: Написать failing DOM regression-тест**

Проверить summary content wrapper; новые узбекские headings; отсутствие служебного текста и `Push triggerlar`; `data-label` у заявок и журнала; дату `DD.MM.YYYY`.

- [ ] **Step 2: Написать failing CSS contract test**

Проверить mobile 2×2 summary, block/card table layout, скрытый `thead`, отсутствие table-scroll overflow и двухколоночные actions.

- [ ] **Step 3: Подтвердить RED**

Run: `corepack pnpm --filter @golden-study/web exec vitest run src/App.test.tsx src/telegramResponsive.test.ts -t "renders compact telegram mobile workflow" --reporter=dot`

Expected: FAIL — wrappers, labels и responsive rules отсутствуют.

- [ ] **Step 4: Реализовать JSX**

Добавить summary content wrappers и `data-label`; локализовать headings; удалить служебный paragraph и `telegram-rules`; сделать deterministic date formatter.

- [ ] **Step 5: Реализовать responsive CSS**

Mobile: summary 2×2; обе таблицы как карточки; actions 2 колонки/full-width; no horizontal scroll. Desktop сохранить table layout.

- [ ] **Step 6: Подтвердить GREEN**

Run: `corepack pnpm --filter @golden-study/web exec vitest run src/App.test.tsx src/telegramResponsive.test.ts -t "renders compact telegram mobile workflow" --reporter=dot`

Expected: PASS.

- [ ] **Step 7: Полные проверки**

Run: `corepack pnpm test`
Run: `corepack pnpm lint`
Run: `corepack pnpm typecheck`
Run: `corepack pnpm build`

Expected: exit code 0; допустимо известное Vite warning о chunk > 500 kB.

- [ ] **Step 8: Обновить журнал**

Записать изменения, файлы, команды, результаты и отсутствие Browser QA в `docs/PROGRESS.md`.
