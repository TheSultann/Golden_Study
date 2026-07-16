# Attendance UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перестроить `Davomat` в компактный desktop-журнал и удобные mobile-карточки без изменения бизнес-логики.

**Architecture:** `AttendancePage` сохраняет текущие hooks, dirty-state и mutations, но получает явные структурные контейнеры для responsive layout. Все конфликтующие attendance CSS-слои заменяются одним module block и одним mobile media query.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Playwright CLI.

## Global Constraints

- Не менять `UI → TanStack Query hooks → Repository` flow.
- Не менять API-контракты, mock data и бизнес-правила.
- Не добавлять зависимости.
- Mobile interaction targets: минимум `40px`.
- UI: узбекский, латиница; dark/light themes.

---

### Task 1: Attendance structure, responsive UI и regression coverage

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/pages/AttendancePage.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: `AttendanceRow`, `useAttendance(groupId, date)`, `useSaveAttendance()`.
- Produces: `.attendance-card-head`, `.attendance-card-status`, `.attendance-card-meta`, `.attendance-card-comment`, `.attendance-savebar`.

- [ ] **Step 1: Write failing regression test**

В существующем тесте `/attendance` получить строку Sardor и проверить новые structural hooks:

```tsx
const row = screen.getByRole('row', { name: /Sardor Abdullayev/ })
expect(row.querySelector('.attendance-card-head')).toBeInTheDocument()
expect(row.querySelector('.attendance-card-status')).toBeInTheDocument()
expect(row.querySelector('.attendance-card-meta')).toBeInTheDocument()
expect(row.querySelector('.attendance-card-comment')).toBeInTheDocument()
expect(screen.getByRole('button', { name: 'Saqlash' }).closest('.attendance-savebar')).toBeInTheDocument()
```

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @golden-study/web test -- --run -t "renders compact attendance workflow"`

Expected: FAIL because `.attendance-card-head` does not exist.

- [ ] **Step 3: Add explicit React structure**

Сгруппировать существующие controls без изменения handlers:

```tsx
<td className="attendance-card-head">
  <strong>{r.studentName}</strong>
  <small>{r.studentCode}</small>
</td>
<td className="attendance-card-status" data-label="Holat">...</td>
<td className="attendance-card-meta attendance-card-rating" data-label="Reyting">...</td>
<td className="attendance-card-meta attendance-card-homework" data-label="Uy vazifasi">...</td>
<td className="attendance-card-comment" data-label="Izoh">...</td>
```

Переименовать save container без изменения state logic:

```tsx
<div className="attendance-actions attendance-savebar" aria-live="polite">...</div>
```

- [ ] **Step 4: Consolidate attendance CSS**

Удалить конфликтующие `.attendance-*` определения и оставить один base block. Desktop: compact workbar/table/savebar. Mobile: `tr` как grid-карточка с областями:

```css
grid-template-areas:
  "head head"
  "status status"
  "rating homework"
  "comment comment";
```

Mobile savebar: sticky, compact; table получает bottom padding. Не использовать `td::before` для композиции карточки.

- [ ] **Step 5: Verify GREEN**

Run: `corepack pnpm --filter @golden-study/web test -- --run -t "renders compact attendance workflow"`

Expected: PASS.

- [ ] **Step 6: Rendered QA**

Проверить `/attendance` в dark/light themes на `1280×800` и `390×844`: no overflow/clipping; status, rating, homework, comment и save interactions работают; console errors/warnings = 0.

- [ ] **Step 7: Full verification**

Run: `corepack pnpm test && corepack pnpm lint && corepack pnpm typecheck && corepack pnpm build`

Expected: exit code `0`; допустимо существующее Vite warning о chunk >500 kB.

- [ ] **Step 8: Update progress**

В `docs/PROGRESS.md` записать root cause, изменённые файлы, QA viewports, команды и результаты.

