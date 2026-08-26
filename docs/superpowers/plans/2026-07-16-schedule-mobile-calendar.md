# Mobile Schedule Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать режим `Kalendar` удобным на mobile без горизонтальной прокрутки и без изменений desktop.

**Architecture:** Существующий React DOM уже семантически разделён на дни. Изменение ограничивается responsive CSS: на ширине до 760 px семиколоночная сетка становится одной колонкой, а минимальная ширина дня сбрасывается.

**Tech Stack:** React, TypeScript, CSS media queries, Vitest, Testing Library, Playwright.

## Global Constraints

- Desktop-сетка из семи колонок остаётся без изменений.
- Режим `Kartochkalar`, фильтры, данные и добавление урока не меняются.
- На 390 px отсутствует горизонтальное переполнение календаря и страницы.
- Новые зависимости не добавляются.

---

### Task 1: Mobile calendar regression

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: `.schedule-calendar`, `.schedule-day`, существующий переключатель `Kalendar`.
- Produces: responsive CSS-контракт одной колонки до 760 px.

- [x] **Step 1: Write the failing test**

Добавить проверку CSS-контракта: в mobile media query `.schedule-calendar` использует `grid-template-columns: minmax(0, 1fr)`, `overflow-x: visible`, а `.schedule-day` — `min-width: 0`.

- [x] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter web test -- --run`

Expected: FAIL, потому что mobile override отсутствует.

- [x] **Step 3: Write minimal implementation**

В `@media (max-width: 760px)` добавить:

```css
.schedule-calendar { grid-template-columns: minmax(0, 1fr); overflow-x: visible; }
.schedule-day { min-width: 0; }
```

- [x] **Step 4: Run test to verify it passes**

Run: `corepack pnpm --filter web test -- --run`

Expected: PASS.

- [x] **Step 5: Verify rendered UI**

Playwright flow: `/schedule` → `Kalendar` → 390 × 844. Проверить `scrollWidth === clientWidth` для документа и `.schedule-calendar`; затем проверить desktop 1440 × 900.

- [x] **Step 6: Run project checks**

Run: `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm build`

Expected: exit code 0.

- [x] **Step 7: Update progress and commit**

Записать изменение, файлы и результаты проверок в `docs/PROGRESS.md`, затем создать один логический commit.
