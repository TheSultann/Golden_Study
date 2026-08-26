# Personal Color Palettes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить персональное переключение между палитрами `Golden` и `Ocean` в настройках.

**Architecture:** Модуль `appearance` хранит типы, localStorage-адаптер и React context. `AppShell` применяет `data-palette`, а `SettingsPage` показывает две доступные палитры. CSS-переменные отделяют брендовый акцент от смысловых статусов.

**Tech Stack:** React, TypeScript, CSS custom properties, Vitest, Testing Library.

## Global Constraints

- `Golden` остаётся дефолтной палитрой.
- `Ocean` использует акцент `#2563EB`, тёмный акцент `#1D4ED8`, фон `#F6F8FC`.
- Выбор хранится отдельно для каждого пользователя.
- Светлая/тёмная тема работает независимо.
- Цвета успеха, ошибки и ожидания не меняются.
- Новые зависимости, API и backend-контракты не добавлять.

---

### Task 1: Appearance storage и context

**Files:**
- Create: `apps/web/src/features/appearance/appearance.tsx`
- Test: `apps/web/src/appearance.test.tsx`
- Modify: `apps/web/src/widgets/app-shell/AppShell.tsx`

**Interfaces:**
- Produces: `type ColorPalette = 'golden' | 'ocean'`.
- Produces: `AppearanceProvider({ userId, children })`.
- Produces: `useAppearance(): { palette: ColorPalette; setPalette(value): void }`.

- [ ] Написать failing-тест: неизвестное значение возвращает `golden`, ключ содержит `userId`, изменение сохраняется и ставит `data-palette="ocean"`.
- [ ] Запустить `corepack pnpm --filter web exec vitest run src/appearance.test.tsx` и получить ожидаемый FAIL.
- [ ] Реализовать storage и context; обернуть содержимое `AppShell` в provider.
- [ ] Повторить targeted-тест и получить PASS.

### Task 2: Выбор палитры в Sozlamalar

**Files:**
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Modify: `apps/web/src/index.css`
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `useAppearance()`.
- Produces: блок `Interfeys rangi` с кнопками `Golden` и `Ocean`, `aria-pressed` и мгновенным применением.

- [ ] Написать failing integration-тест: открыть настройки, выбрать `Ocean`, проверить активную кнопку и `data-palette`.
- [ ] Запустить targeted App-тест и подтвердить ожидаемый FAIL.
- [ ] Добавить компактный selector для admin и teacher; добавить `data-palette='ocean'` CSS variables и responsive-стили.
- [ ] Повторить targeted-тест и получить PASS.

### Task 3: Проверка и журнал

**Files:**
- Modify: `docs/PROGRESS.md`

- [ ] Запустить `corepack pnpm test`, `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`.
- [ ] Записать изменённые файлы, количество тестов и результаты проверок в `docs/PROGRESS.md`.
