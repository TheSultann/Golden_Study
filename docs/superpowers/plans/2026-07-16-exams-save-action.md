# Imtihonlar Save Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переместить сохранение результатов экзамена из header в контекстную responsive-панель после списка.

**Architecture:** Существующий local draft и `useSaveExam` сохраняются. `ExamsPage` получает явные dirty/success/error состояния; action-панель рендерится после таблицы только при полезном состоянии. CSS задаёт desktop layout и mobile full-width.

**Tech Stack:** React, TypeScript, TanStack Query, Vitest, Testing Library, CSS.

## Global Constraints

- Не менять repository, API-контракты и бизнес-логику.
- Browser/Playwright QA не выполнять.
- После изменения обновить `docs/PROGRESS.md`.

---

### Task 1: Контекстное сохранение результатов

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/pages/ExamsPage.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: существующие `draft`, `saveResults()`, `saveMutation`.
- Produces: `.exam-results-actions` после `.table-scroll`, dirty/success/error UI.

- [ ] **Step 1: Написать failing regression-тест**

Проверить: clean-состояние не показывает кнопку; изменение балла показывает `Saqlanmagan o‘zgarishlar` и кнопку; панель DOM следует после `.table-scroll`.

- [ ] **Step 2: Запустить targeted test и подтвердить RED**

Run: `corepack pnpm --filter @golden-study/web test -- --run -t "places exam save action after edited results"`

Expected: FAIL — текущая кнопка видна до изменения и находится в header.

- [ ] **Step 3: Реализовать минимальную правку**

Добавить сравнение active exam с draft, feedback state, убрать кнопку из header, добавить условный footer после `.table-scroll`.

- [ ] **Step 4: Добавить responsive CSS**

Desktop: status слева, action справа. Mobile: вертикальная панель, кнопка `width: 100%`, высота `42px`.

- [ ] **Step 5: Запустить targeted test и подтвердить GREEN**

Run: `corepack pnpm --filter @golden-study/web test -- --run -t "places exam save action after edited results"`

Expected: PASS.

- [ ] **Step 6: Полная проверка**

Run: `corepack pnpm test`
Run: `corepack pnpm lint`
Run: `corepack pnpm typecheck`
Run: `corepack pnpm build`

Expected: все команды успешны; допустимо известное Vite warning о chunk > 500 kB.

- [ ] **Step 7: Обновить журнал**

Добавить в `docs/PROGRESS.md`: UX-изменение, файлы, команды и результаты.
