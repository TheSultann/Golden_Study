# Students Mobile Card Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать мобильные карточки учеников и кнопки заголовка компактными, ровными и устойчивыми к CSS-конфликтам.

**Architecture:** Сохранить текущую React-разметку и portal dropdown. Удалить конфликтующие student-specific mobile declarations и закрепить один финальный набор правил с локальной областью `.students-page`.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Не менять бизнес-логику, данные, repositories и API-контракты.
- Не менять несвязанные экраны.
- Mobile controls: `40×40px`; icons: `16px`.
- Основной язык UI: узбекский, латиница.

---

### Task 1: Regression coverage и точечный UI-fix

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/pages/StudentsPage.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: существующий route `/students`, `StudentsPage`, `useStudents`.
- Produces: неизменённые accessible buttons `Eksport`, `O‘quvchi qo‘shish`, `<student code> amallari`.

- [ ] **Step 1: Добавить failing regression test**

Проверить, что `/students` показывает имя перед ID и доступные имена всех трёх mobile controls.

- [ ] **Step 2: Запустить test до исправления**

Run: `corepack pnpm --filter @golden-study/web test -- --run`

Expected: новый regression assertion падает на недостающем структурном hook/class.

- [ ] **Step 3: Внести минимальное исправление**

Добавить семантические классы имени/ID и `aria-label` кнопкам заголовка. В финальном mobile CSS задать один layout: `72px minmax(0,1fr)`, action zone/button `40×40px`, header buttons `40×40px`, icons `16px`. Удалить только конфликтующие `.students-table` mobile declarations.

- [ ] **Step 4: Проверить test и статические проверки**

Run: `corepack pnpm test`

Expected: все тесты PASS.

Run: `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm build`

Expected: exit code `0` для всех команд.

- [ ] **Step 5: Rendered QA**

Открыть `/students` при `390×844` и desktop viewport. Проверить страницу, console, отсутствие overlay, расположение текста/иконок и открытие `…` dropdown.

- [ ] **Step 6: Обновить журнал**

Записать в `docs/PROGRESS.md` дату, root cause, изменённые файлы, команды проверки, следующий шаг.

