# Courses and Groups UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать разделы `Kurslar` и `Guruhlar` кликабельными, понятными, безопасными при смене статуса и удобными на mobile.

**Architecture:** Существующий поток TanStack Query/repository и доменные контракты остаются без изменений. UI-поведение реализуется в страницах; общий диалог подтверждения выносится в shared-компонент; визуальные и responsive-состояния добавляются в существующий stylesheet.

**Tech Stack:** React 19, TypeScript 6 strict, TanStack Query 5, React Testing Library, Vitest, CSS.

## Global Constraints

- Не менять `Course`, `Group`, repository-интерфейсы и бизнес-правила.
- UI-даты: `DD.MM.YYYY`; данные: ISO 8601.
- Основной язык видимого UI: узбекский, латиница.
- Минимальная зона нажатия интерактивных элементов: 40 px.
- Не добавлять зависимости.
- После реализации обновить `docs/PROGRESS.md`.

---

### Task 1: Shared confirmation dialog

**Files:**
- Create: `apps/web/src/shared/ui/ConfirmDialog.tsx`
- Create: `apps/web/src/shared/ui/ConfirmDialog.test.tsx`

**Interfaces:**
- Produces: `ConfirmDialog({ title, description, confirmLabel, pending, onConfirm, onCancel })`.
- Consumes: только React callbacks и существующие классы кнопок/модалки.

- [ ] **Step 1: Write failing component test**

Добавить `ConfirmDialog.test.tsx`: render диалога, проверка `role="alertdialog"`, клик `Bekor qilish` вызывает `onCancel`, клик подтверждения вызывает `onConfirm`, `pending=true` блокирует обе кнопки и показывает `Saqlanmoqda...`.

- [ ] **Step 2: Run focused test and verify failure**

Run: `corepack pnpm --filter @golden-study/web test -- ConfirmDialog.test.tsx`

Expected: FAIL — модуль `ConfirmDialog` отсутствует.

- [ ] **Step 3: Create accessible reusable dialog**

```tsx
type ConfirmDialogProps = {
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <div className="modal-backdrop">
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
        <h2 id="confirm-title">{props.title}</h2>
        <p id="confirm-description">{props.description}</p>
        <footer>
          <button type="button" className="secondary-button" disabled={props.pending} onClick={props.onCancel}>Bekor qilish</button>
          <button type="button" className="danger-button" disabled={props.pending} onClick={props.onConfirm}>{props.pending ? 'Saqlanmoqda...' : props.confirmLabel}</button>
        </footer>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run focused test**

Run: `corepack pnpm --filter @golden-study/web test -- ConfirmDialog.test.tsx`

Expected: PASS.

### Task 2: Kurslar interactions and states

**Files:**
- Modify: `apps/web/src/pages/CoursesPage.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Consumes: `ConfirmDialog` from Task 1; existing `useCourses`, `useSaveCourse`, `useSetCourseActive`.
- Produces: keyboard-accessible `.course-card`, safe status flow, mutation/error/empty states.

- [ ] **Step 1: Add failing tests**

Добавить сценарии:

```tsx
await user.click(await screen.findByText('IELTS Preparation'))
expect(screen.getByRole('heading', { name: 'Kursni tahrirlash' })).toBeInTheDocument()

await user.click(screen.getByRole('button', { name: 'Yopish' }))
await user.click(screen.getByRole('button', { name: 'IELTS Preparation holati: Faol' }))
expect(screen.getByRole('alertdialog', { name: 'Kursni faolsiz qilish' })).toBeInTheDocument()
```

Также проверить, что клик статусной кнопки не открывает форму редактирования.

- [ ] **Step 2: Verify failure**

Run: `corepack pnpm --filter @golden-study/web test -- -t "course card|course deactivation"`

Expected: FAIL на новой доступной карточке/диалоге.

- [ ] **Step 3: Implement interaction model**

- Добавить `pendingStatus: Course | null`.
- Карточке добавить `role="button"`, `tabIndex={0}`, `aria-label`, `onClick`, обработку Enter/Space.
- Статусной кнопке добавить точный `aria-label`, `stopPropagation()` и confirmation только при `active === true`.
- Для повторной активации вызвать mutation сразу.
- При `activeMutation.isPending` отключить статусные действия.
- Форме передать `pending={saveMutation.isPending}`; блокировать submit/cancel/close, показывать `Saqlanmoqda...`.
- Добавить `query.isError`, `filtered.length === 0`, `saveMutation.isError`, `activeMutation.isError` с узбекскими сообщениями.

- [ ] **Step 4: Implement CSS**

- `.course-card`: cursor, transition, hover/focus-visible, active transform.
- Вложенные кнопки: минимум 40×40 px, focus-visible.
- `.confirm-dialog`, `.danger-button`, `.form-error`, `.empty-state`.
- `@media (prefers-reduced-motion: reduce)` без transform/transition.

- [ ] **Step 5: Run tests**

Run: `corepack pnpm --filter @golden-study/web test -- -t "course"`

Expected: PASS.

### Task 3: Guruhlar interactions, dates and mobile cards

**Files:**
- Modify: `apps/web/src/pages/GroupsPage.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Consumes: `ConfirmDialog`; existing group Query hooks.
- Produces: keyboard-accessible rows, `formatDate(date: string): string`, semantic statuses, responsive table-to-card layout.

- [ ] **Step 1: Add failing tests**

Добавить сценарии:

```tsx
await user.click(await screen.findByText('IELTS-24-01'))
expect(screen.getByRole('heading', { name: 'Guruhni tahrirlash' })).toBeInTheDocument()

expect(await screen.findByText('01.02.2026')).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'IELTS-24-01 guruhini yakunlash' }))
expect(screen.getByRole('alertdialog', { name: 'Guruhni yakunlash' })).toBeInTheDocument()
```

Проверить отмену и подтверждение завершения; статусная кнопка не должна открывать редактирование.

- [ ] **Step 2: Verify failure**

Run: `corepack pnpm --filter @golden-study/web test -- -t "group row|group completion|formats group dates"`

Expected: FAIL на доступной строке, диалоге и формате даты.

- [ ] **Step 3: Implement row behavior and states**

- Добавить чистую функцию `formatDate`, преобразующую `YYYY-MM-DD` через split без timezone-сдвига.
- Добавить `pendingStatus: Group | null`.
- Строке добавить `tabIndex={0}`, `aria-label`, `onClick`, Enter/Space.
- Всем вложенным кнопкам добавить `stopPropagation()`.
- Заменить текстовый status `<small>` на `.status-badge`.
- Добавить query error, empty, save/status mutation error, pending/disabled-состояния.
- Добавить `aria-labelledby` форме группы.

- [ ] **Step 4: Implement responsive CSS**

На desktop сохранить таблицу. При `max-width: 760px`:

```css
.groups-table table,
.groups-table tbody { display: block; }
.groups-table thead { display: none; }
.groups-table tr { display: grid; grid-template-columns: 1fr 1fr; }
.groups-table td { white-space: normal; }
.groups-table td::before { content: attr(data-label); }
```

Каждому `td` добавить `data-label`; первая и action-ячейка занимают обе колонки. Убрать горизонтальный скролл, добавить ясные границы, hover/focus и зоны нажатия 40 px.

- [ ] **Step 5: Run focused tests**

Run: `corepack pnpm --filter @golden-study/web test -- -t "group"`

Expected: PASS.

### Task 4: Full verification and progress

**Files:**
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: результаты Tasks 1–3.
- Produces: проверенный инкремент и журнал работы.

- [ ] **Step 1: Run all automated checks**

```powershell
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

Expected: все команды exit code 0.

- [ ] **Step 2: Browser QA**

Проверить `/courses` и `/groups` при desktop 1440×900 и mobile 390×844: клики, keyboard focus, hover, подтверждения, формы, отсутствие horizontal overflow, mobile-карточки, даты.

- [ ] **Step 3: Update progress**

Записать дату, изменённые файлы, выполненные проверки, найденные ограничения и следующий шаг в `docs/PROGRESS.md`.

- [ ] **Step 4: Final commit**

```powershell
git add apps/web/src/shared/ui/ConfirmDialog.tsx apps/web/src/pages/CoursesPage.tsx apps/web/src/pages/GroupsPage.tsx apps/web/src/App.test.tsx apps/web/src/index.css docs/PROGRESS.md
git commit -m "feat(web): improve courses groups UX"
```
