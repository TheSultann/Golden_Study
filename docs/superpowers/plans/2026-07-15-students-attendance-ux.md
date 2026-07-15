# Students and Attendance UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Улучшить удобство, доступность и адаптивность разделов `O‘quvchilar` и `Davomat`, сохранив текущий стиль CRM и бизнес-логику.

**Architecture:** Страницы продолжают получать данные только через существующие TanStack Query hooks и repositories. UI-состояния остаются локальными; повторно используем существующий `ConfirmDialog`, а новые небольшие компоненты выносим только там, где это сокращает ответственность страниц.

**Tech Stack:** React 19, TypeScript strict, TanStack Query, Testing Library, Vitest, CSS, Lucide React, Playwright CLI.

## Global Constraints

- Сохранить поток `UI → TanStack Query → Repository`.
- Не менять бизнес-правила посещаемости, биллинга и статусов.
- Не добавлять зависимости.
- Интерфейс: узбекский, латиница; даты `DD.MM.YYYY`; валюта UZS.
- Минимальная интерактивная зона — 40 px; обязательны hover, focus-visible, active, disabled и loading.
- Desktop QA: `1440×900`; mobile QA: `390×844`.

## File Map

- Modify: `apps/web/src/pages/StudentsPage.tsx` — фильтрация, счётчики, статусы, меню, уведомления и состояния реестра.
- Modify: `apps/web/src/pages/AttendancePage.tsx` — dirty-state, безопасная смена фильтров, компактный журнал и сохранение.
- Modify: `apps/web/src/index.css` — desktop/mobile стили обоих разделов и интерактивные состояния.
- Modify: `apps/web/src/App.test.tsx` — интеграционные component-тесты пользовательских сценариев.
- Modify: `docs/PROGRESS.md` — результат и команды проверки.

---

### Task 1: Безопасный и понятный реестр студентов

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/pages/StudentsPage.tsx`

**Interfaces:**
- Consumes: `useStudents()`, `useSaveStudent()`, `useSetStudentStatus()`, `Student`.
- Produces: helper `loginAsAdmin(user: ReturnType<typeof userEvent.setup>): Promise<void>`, вкладки со счётчиками, очищаемый поиск, empty-state, status badge, подтверждение заморозки, доступное меню действий и встроенное уведомление.

- [ ] **Step 1: Написать падающие тесты реестра**

Добавить сценарии после существующего теста реестра:

```tsx
async function loginAsAdmin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Login'), 'admin')
  await user.type(screen.getByLabelText('Parol'), 'admin123')
  await user.click(screen.getByRole('button', { name: 'Kirish' }))
  await screen.findByRole('heading', { name: 'Bosh sahifa' })
}

it('filters students, clears search and shows an empty state', async () => {
  const user = userEvent.setup(); renderApp(); await loginAsAdmin(user)
  await user.click(await screen.findByRole('link', { name: 'O‘quvchilar' }))
  await screen.findByText('ST101')
  await user.type(screen.getByRole('searchbox', { name: 'O‘quvchi qidirish' }), 'topilmadi')
  expect(screen.getByText('O‘quvchi topilmadi')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Qidiruvni tozalash' }))
  expect(await screen.findByText('ST101')).toBeInTheDocument()
})

it('confirms freezing from the student actions menu', async () => {
  const user = userEvent.setup(); renderApp(); await loginAsAdmin(user)
  await user.click(await screen.findByRole('link', { name: 'O‘quvchilar' }))
  await screen.findByText('ST101')
  await user.click(screen.getByRole('button', { name: 'ST101 amallari' }))
  await user.click(screen.getByRole('menuitem', { name: 'Muzlatish' }))
  expect(screen.getByRole('alertdialog', { name: 'O‘quvchini muzlatish' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Проверить падение тестов**

Run: `corepack pnpm --filter @golden-study/web test -- src/App.test.tsx`

Expected: FAIL — отсутствуют `searchbox`, кнопка очистки, menu semantics и подтверждение заморозки.

- [ ] **Step 3: Реализовать UX-состояния**

В `StudentsPage`:

```tsx
const counts = useMemo(() => ({
  active: data.filter((student) => student.status === 'active').length,
  frozen: data.filter((student) => student.status === 'frozen').length,
  graduate: data.filter((student) => student.status === 'graduate').length,
  all: data.length,
}), [data])

const [pendingStatus, setPendingStatus] = useState<Student | null>(null)
const [notice, setNotice] = useState<string | null>(null)
```

- Добавить `role="searchbox"`, кнопку `Qidiruvni tozalash` при непустом запросе и empty-state `O‘quvchi topilmadi`.
- Выводить в табе подпись и `counts[x]`.
- Заменить inline `<select>` на status badge; изменение статуса оставить в меню.
- Назначить меню `role="menu"`, пунктам `role="menuitem"`, закрывать по `Escape`, возвращать focus на trigger.
- Для `Muzlatish` сначала открывать `ConfirmDialog`; после подтверждения вызывать `statusM.mutate`.
- Вместо `alert()` показывать `role="status"` с текстом mock-экспорта.

- [ ] **Step 4: Проверить тесты реестра**

Run: `corepack pnpm --filter @golden-study/web test -- src/App.test.tsx`

Expected: PASS для новых и существующих student-сценариев.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/StudentsPage.tsx apps/web/src/App.test.tsx
git commit -m "feat(students): improve registry interactions"
```

---

### Task 2: Визуальная и мобильная полировка студентов

**Files:**
- Modify: `apps/web/src/pages/StudentsPage.tsx`
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Consumes: DOM-классы и состояния Task 1.
- Produces: компактная desktop-таблица и mobile-карточки без горизонтального скролла.

- [ ] **Step 1: Добавить проверяемые семантические классы**

Использовать структуру:

```tsx
<span className={`student-status student-status--${student.status}`}>{labels[student.status]}</span>
<div className="student-primary">...</div>
<div className="student-groups">...</div>
<div className="student-empty" role="status">...</div>
```

- [ ] **Step 2: Добавить desktop/mobile стили**

В конце профильного блока `index.css` определить:

```css
.students-table tbody tr { transition: background-color .16s ease, box-shadow .16s ease; }
.students-table tbody tr:hover { background: color-mix(in srgb, var(--gold) 5%, var(--surface)); }
.student-status { display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:500; }
.student-status--active { color:#15803d;background:rgb(34 197 94 / 10%); }
.student-status--frozen { color:#b45309;background:rgb(245 158 11 / 12%); }
.student-status--graduate { color:var(--muted);background:var(--surface-soft); }
.student-tabs button:focus-visible,.actions-dropdown-trigger:focus-visible { outline:2px solid var(--gold);outline-offset:2px; }
@media (max-width:760px) {
  .students-table tr { grid-template-columns:minmax(0,1fr) auto; }
  .students-table td { min-width:0; }
  .students-table td[data-label="Telefon"],.students-table td[data-label="Ota-ona"],.students-table td[data-label="Guruhlar"] { grid-column:1/-1; }
}
```

Уточнить селекторы под существующую mobile-разметку, сохранить зоны нажатия `40px` и убрать дублирующие старые правила.

- [ ] **Step 3: Проверить component-тесты**

Run: `corepack pnpm --filter @golden-study/web test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/StudentsPage.tsx apps/web/src/index.css
git commit -m "style(students): polish responsive registry"
```

---

### Task 3: Защита несохранённых изменений Davomat

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/pages/AttendancePage.tsx`

**Interfaces:**
- Consumes: `AttendanceRow`, `useAttendance(groupId, date)`, `useSaveAttendance()`, `ConfirmDialog`.
- Produces: `requestFilterChange(nextGroupId, nextDate)`, подтверждение потери изменений, счётчик изменений, error/success состояния сохранения.

- [ ] **Step 1: Написать падающие тесты dirty-state**

```tsx
it('warns before changing attendance filters with unsaved changes', async () => {
  const user = userEvent.setup(); renderApp(); await loginAsAdmin(user)
  await user.click(await screen.findByRole('link', { name: 'Davomat' }))
  await screen.findByText('Sardor Abdullayev')
  await user.click(screen.getByRole('button', { name: 'Sardor Abdullayev: Sababsiz' }))
  expect(screen.getByText('1 ta saqlanmagan o‘zgarish')).toBeInTheDocument()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Guruh' }), 'g2')
  expect(screen.getByRole('alertdialog', { name: 'O‘zgarishlar saqlanmagan' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Bekor qilish' }))
  expect(screen.getByRole('combobox', { name: 'Guruh' })).toHaveValue('g1')
})
```

- [ ] **Step 2: Проверить падение теста**

Run: `corepack pnpm --filter @golden-study/web test -- src/App.test.tsx`

Expected: FAIL — нет счётчика и подтверждения.

- [ ] **Step 3: Реализовать безопасную смену фильтра**

Добавить:

```tsx
type PendingFilter = { groupId: string; date: string }
const [pendingFilter, setPendingFilter] = useState<PendingFilter | null>(null)
const changedCount = q.data?.rows.reduce((count, original) => {
  const current = rows.find((row) => row.studentId === original.studentId)
  return count + (JSON.stringify(current) === JSON.stringify(original) ? 0 : 1)
}, 0) ?? 0

function requestFilterChange(next: PendingFilter) {
  if (changedCount > 0) return setPendingFilter(next)
  setGroupId(next.groupId); setDate(next.date)
}
```

- Select/date вызывают `requestFilterChange`.
- `ConfirmDialog` с заголовком `O‘zgarishlar saqlanmagan` применяет pending filter только после подтверждения.
- Панель показывает `${changedCount} ta saqlanmagan o‘zgarish`.
- Ошибка mutation отображается через `role="alert"`; введённые строки не сбрасываются.
- Кнопка сохранения disabled при `changedCount === 0 || save.isPending`.

- [ ] **Step 4: Проверить тесты Davomat**

Run: `corepack pnpm --filter @golden-study/web test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/AttendancePage.tsx apps/web/src/App.test.tsx
git commit -m "feat(attendance): protect unsaved changes"
```

---

### Task 4: Компактный доступный журнал Davomat

**Files:**
- Modify: `apps/web/src/pages/AttendancePage.tsx`
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Consumes: состояния Task 3.
- Produces: рабочая панель фильтров/сводки, компактные строки и mobile-карточки, доступные статусы/рейтинг/ДЗ.

- [ ] **Step 1: Уточнить доступную разметку**

Для каждого интерактивного элемента задать стабильные подписи:

```tsx
<button aria-pressed={r.status === v} aria-label={`${r.studentName}: ${l}`}>...</button>
<button aria-pressed={n <= r.rating} aria-label={`${r.studentName}: ${n} yulduz`}>...</button>
<input aria-label={`${r.studentName} izoh`} ... />
```

Сводку обернуть в `aria-label="Davomat xulosasi"`, панель сохранения — в `aria-live="polite"`.

- [ ] **Step 2: Реализовать компактные стили**

```css
.attendance-workbar { display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap; }
.attendance-summary { border:0;padding:0;gap:8px; }
.attendance-summary span { display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border-radius:999px;background:var(--surface-soft); }
.status-choice button,.rating button,.custom-checkbox-container { min-width:40px;min-height:40px; }
.attendance-actions { position:sticky;bottom:12px;z-index:10;box-shadow:0 8px 30px rgb(15 23 42 / 12%); }
@media (max-width:760px) {
  .attendance-table tbody { gap:10px;padding:10px; }
  .attendance-table td { grid-template-columns:68px minmax(0,1fr);padding:7px 9px; }
  .attendance-table .status-choice { display:grid;grid-template-columns:repeat(3,minmax(0,1fr)); }
  .attendance-actions { margin:0 8px 8px;bottom:8px; }
  .attendance-table { padding-bottom:76px; }
}
```

Убрать конфликтующие повторные определения `.attendance-actions`, `.rating button` и mobile attendance rules.

- [ ] **Step 3: Проверить component-тесты**

Run: `corepack pnpm --filter @golden-study/web test -- src/App.test.tsx`

Expected: PASS, включая teacher attendance.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/AttendancePage.tsx apps/web/src/index.css
git commit -m "style(attendance): polish responsive journal"
```

---

### Task 5: Полная проверка и журнал прогресса

**Files:**
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: завершённые Tasks 1–4.
- Produces: проверенный UI и запись о выполнении.

- [ ] **Step 1: Запустить автоматические проверки**

```bash
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

Expected: все команды завершаются с exit code `0`.

- [ ] **Step 2: Провести rendered QA через Playwright CLI**

```bash
playwright-cli goto http://localhost:5173/students
playwright-cli resize 1440 900
playwright-cli snapshot
playwright-cli screenshot
playwright-cli resize 390 844
playwright-cli reload
playwright-cli screenshot
playwright-cli goto http://localhost:5173/attendance
playwright-cli resize 1440 900
playwright-cli screenshot
playwright-cli resize 390 844
playwright-cli reload
playwright-cli screenshot
playwright-cli console warning
```

Expected: страницы не пустые, overlay отсутствует, relevant console errors/warnings отсутствуют; меню, поиск, статус, dirty-confirmation и сохранение меняют UI ожидаемо.

- [ ] **Step 3: Обновить `docs/PROGRESS.md`**

Добавить дату, сделанные UX-изменения, точные изменённые файлы, результаты четырёх команд и rendered QA, следующий шаг.

- [ ] **Step 4: Commit**

```bash
git add docs/PROGRESS.md
git commit -m "docs: record students attendance ux polish"
```
