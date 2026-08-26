# Reports Finance Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать доход, расход и финансовый результат в `Hisobotlar` визуально и текстово различимыми.

**Architecture:** Существующий `reportSummary` расширяется семантическим типом показателя. `ReportsPage` преобразует тип в CSS-модификатор и иконку, не меняя repositories и финансовые контракты.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library.

## Global Constraints

- Новые зависимости и API не добавлять.
- Доход обозначать зелёным, расход красным, нейтральный показатель без смыслового цвета.
- Отрицательную чистую прибыль показывать как `Zarar` с абсолютной суммой.
- Mobile сохраняет сетку 2×2 без горизонтального скролла.

---

### Task 1: Семантические финансовые карточки

**Files:**
- Modify: `apps/web/src/pages/ReportsPage.tsx`
- Modify: `apps/web/src/index.css`
- Test: `apps/web/src/App.test.tsx`
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: `FinanceOverview`, `reportSummary(tab, finance, attendance, exams)`.
- Produces: summary items `{ label, value, tone }`, где `tone` — `income | expense | profit | loss | neutral`.

- [ ] **Step 1: Write the failing test**

Добавить интеграционный тест, который открывает `Hisobotlar → Kirim-chiqim` и проверяет классы `income`, `expense`, `profit`, `neutral`, подписи и суммы.

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter web exec vitest run src/App.test.tsx -t "uses financial semantics"`

Expected: FAIL, потому что карточки не имеют семантических классов.

- [ ] **Step 3: Write minimal implementation**

Вернуть из `reportSummary` объекты с `tone`, добавить иконки в карточки и CSS-модификаторы с мягкими зелёными/красными состояниями. Для отрицательного `finance.summary.profit` вернуть `{ label: 'Zarar', value: money(Math.abs(profit)), tone: 'loss' }`.

- [ ] **Step 4: Run targeted test**

Run: `corepack pnpm --filter web exec vitest run src/App.test.tsx -t "uses financial semantics"`

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run: `corepack pnpm test && corepack pnpm lint && corepack pnpm typecheck && corepack pnpm build`

Expected: все команды успешны; допустимо известное предупреждение Vite о chunk больше 500 kB.

- [ ] **Step 6: Update progress**

Добавить запись от `2026-07-18` в `docs/PROGRESS.md` с изменёнными файлами и результатами проверок.
