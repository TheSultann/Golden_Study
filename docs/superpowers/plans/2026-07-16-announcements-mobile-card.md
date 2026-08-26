# E’lonlar Mobile Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрепить badge доставки справа сверху mobile-карточки объявления без отдельной строки и наложений.

**Architecture:** Разметка карточки получает отдельные классы header/content/icon/status. Mobile CSS сохраняет три grid-колонки, разрешает content безопасно сжиматься и запрещает перенос badge.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library.

## Global Constraints

- Не менять contracts, repository и бизнес-логику.
- Дата строго `DD.MM.YYYY`.
- Browser/Playwright не запускать.
- Работать в текущем `main` без commit по разрешению пользователя.

---

### Task 1: Mobile header карточки объявления

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/pages/AnnouncementsPage.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: `Announcement`, `statusLabel()`, `formatDate()`.
- Produces: `.announcement-card-header`, `.announcement-card-content`, `.announcement-status` responsive contract.

- [ ] **Step 1: Написать failing regression-тест**

Проверить классы header/content/status и дату `06.07.2026` у `Iyul oyi to‘lovlari`.

- [ ] **Step 2: Подтвердить RED**

Run: `corepack pnpm --filter @golden-study/web exec vitest run src/App.test.tsx -t "keeps announcement status in mobile card header" --reporter=dot`

Expected: FAIL — специальных header/content классов ещё нет.

- [ ] **Step 3: Минимальная реализация**

Добавить семантические классы в `AnnouncementsPage.tsx`. В mobile CSS использовать `grid-template-columns:34px minmax(0,1fr) auto`, `min-width:0` для content и `white-space:nowrap` для status.

- [ ] **Step 4: Подтвердить GREEN**

Run: `corepack pnpm --filter @golden-study/web exec vitest run src/App.test.tsx -t "keeps announcement status in mobile card header" --reporter=dot`

Expected: PASS.

- [ ] **Step 5: Полные проверки**

Run: `corepack pnpm test`
Run: `corepack pnpm lint`
Run: `corepack pnpm typecheck`
Run: `corepack pnpm build`

Expected: exit code 0; допустимо известное Vite warning о chunk > 500 kB.

- [ ] **Step 6: Обновить журнал**

Записать изменение, файлы, команды, результаты и отсутствие Browser QA в `docs/PROGRESS.md`.
