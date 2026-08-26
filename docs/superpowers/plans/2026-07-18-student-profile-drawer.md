# Student Profile Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в реестр учеников быстрый drawer с личной, учебной и финансовой сводкой ученика.

**Architecture:** Новый домен `student-profile` получает агрегированную карточку через TanStack Query и отдельный repository. `StudentsPage` хранит только выбранный `studentId`, а `StudentProfileDrawer` отвечает за loading/error/empty, доступность и отображение данных.

**Tech Stack:** React, TypeScript strict, TanStack Query, Zod contracts, Vitest, Testing Library, CSS.

## Global Constraints

- UI → TanStack Query hook → Repository interface → Mock/API repository.
- UI не импортирует mocks и не рассчитывает академические агрегаты.
- Desktop drawer: 400 px справа; mobile до 760 px: full-screen.
- Клик по `…` не открывает drawer.
- Не добавлять графики, историю по месяцам и новый маршрут.
- Даты API остаются ISO 8601; отображение — `DD.MM.YYYY`.
- Не добавлять зависимости.

---

### Task 1: Контракт и data layer профиля

**Files:**
- Create: `packages/contracts/src/student-profile.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/web/src/mocks/student-profiles.ts`
- Create: `apps/web/src/features/student-profile/studentProfile.repository.ts`
- Create: `apps/web/src/features/student-profile/mockStudentProfile.repository.ts`
- Create: `apps/web/src/features/student-profile/apiStudentProfile.repository.ts`
- Create: `apps/web/src/features/student-profile/studentProfile.dependencies.ts`
- Create: `apps/web/src/features/student-profile/useStudentProfile.ts`
- Test: `apps/web/src/studentProfileRepository.test.ts`

**Interfaces:**
- Produces: `StudentProfile`, `StudentAcademicSummary`.
- Produces: `StudentProfileRepository.getById(studentId: string): Promise<StudentProfile>`.
- Produces: `useStudentProfile(studentId: string | null)`.

- [ ] **Step 1: Write failing repository contract test**

```ts
import { describe, expect, it } from 'vitest'
import { MockStudentProfileRepository } from './features/student-profile/mockStudentProfile.repository'

describe('MockStudentProfileRepository', () => {
  it('returns a complete profile and rejects an unknown student', async () => {
    const repository = new MockStudentProfileRepository()
    await expect(repository.getById('s1')).resolves.toMatchObject({
      student: { id: 's1', code: 'ST101' },
      academicSummary: {
        ratingScore: expect.any(Number),
        groupPlace: expect.any(Number),
        examAveragePercent: expect.any(Number),
        attendancePercent: expect.any(Number),
        homeworkPercent: expect.any(Number),
      },
    })
    await expect(repository.getById('missing')).rejects.toThrow('Student profile not found')
  })
})
```

- [ ] **Step 2: Run test and confirm RED**

Run:

```powershell
corepack pnpm --filter @golden-study/web exec vitest run src/studentProfileRepository.test.ts
```

Expected: FAIL because repository module does not exist.

- [ ] **Step 3: Add Zod contract**

```ts
// packages/contracts/src/student-profile.ts
import { z } from 'zod'
import { studentSchema } from './students'

export const studentAcademicSummarySchema = z.object({
  ratingScore: z.number().int().min(0).max(100).nullable(),
  groupPlace: z.number().int().positive().nullable(),
  examAveragePercent: z.number().int().min(0).max(100).nullable(),
  attendancePercent: z.number().int().min(0).max(100).nullable(),
  homeworkPercent: z.number().int().min(0).max(100).nullable(),
})

export const studentProfileSchema = z.object({
  student: studentSchema,
  academicSummary: studentAcademicSummarySchema,
  updatedAt: z.string(),
})

export const studentProfileResponseSchema = z.object({ data: studentProfileSchema })
export type StudentAcademicSummary = z.infer<typeof studentAcademicSummarySchema>
export type StudentProfile = z.infer<typeof studentProfileSchema>
```

Export it from `packages/contracts/src/index.ts`:

```ts
export * from './student-profile'
```

- [ ] **Step 4: Add repository implementations and hook**

```ts
// studentProfile.repository.ts
import type { StudentProfile } from '@golden-study/contracts'
export interface StudentProfileRepository {
  getById(studentId: string): Promise<StudentProfile>
}
```

```ts
// mockStudentProfile.repository.ts
import type { StudentProfileRepository } from './studentProfile.repository'
import { studentProfiles } from '../../mocks/student-profiles'

const delay = () => new Promise((resolve) => window.setTimeout(resolve, 40))

export class MockStudentProfileRepository implements StudentProfileRepository {
  async getById(studentId: string) {
    await delay()
    const profile = studentProfiles.find((item) => item.student.id === studentId)
    if (!profile) throw new Error('Student profile not found')
    return structuredClone(profile)
  }
}
```

```ts
// apiStudentProfile.repository.ts
import { studentProfileResponseSchema } from '@golden-study/contracts'
import type { StudentProfileRepository } from './studentProfile.repository'

export class ApiStudentProfileRepository implements StudentProfileRepository {
  constructor(private readonly baseUrl: string) {}
  async getById(studentId: string) {
    const response = await fetch(`${this.baseUrl}/students/${studentId}/profile`, { credentials: 'include' })
    if (!response.ok) throw new Error(`Student profile API error: ${response.status}`)
    return studentProfileResponseSchema.parse(await response.json()).data
  }
}
```

```ts
// studentProfile.dependencies.ts
import type { StudentProfileRepository } from './studentProfile.repository'
import { MockStudentProfileRepository } from './mockStudentProfile.repository'
export const studentProfileRepository: StudentProfileRepository = new MockStudentProfileRepository()
```

```ts
// useStudentProfile.ts
import { useQuery } from '@tanstack/react-query'
import { studentProfileRepository } from './studentProfile.dependencies'

export const studentProfileKey = (studentId: string) => ['student-profile', studentId] as const

export function useStudentProfile(studentId: string | null) {
  return useQuery({
    queryKey: studentProfileKey(studentId ?? ''),
    queryFn: () => studentProfileRepository.getById(studentId!),
    enabled: Boolean(studentId),
  })
}
```

Create `studentProfiles` from existing `initialStudents`; use realistic nullable summaries and no formula in UI.

- [ ] **Step 5: Run repository test and typecheck**

```powershell
corepack pnpm --filter @golden-study/web exec vitest run src/studentProfileRepository.test.ts
corepack pnpm typecheck
```

Expected: PASS.

### Task 2: Drawer component

**Files:**
- Create: `apps/web/src/features/student-profile/StudentProfileDrawer.tsx`
- Modify: `apps/web/src/index.css`
- Test: `apps/web/src/studentProfileDrawer.test.tsx`

**Interfaces:**
- Consumes: `useStudentProfile(studentId)`.
- Produces: `StudentProfileDrawer({ studentId, onClose, onEdit })`.

- [ ] **Step 1: Write failing component tests**

```tsx
it('shows identity, academic summary, finance and contacts', async () => {
  render(<StudentProfileDrawer studentId="s1" onClose={vi.fn()} onEdit={vi.fn()} />)
  const dialog = await screen.findByRole('dialog', { name: 'Sardor Abdullayev' })
  expect(dialog).toHaveTextContent('ST101')
  expect(dialog).toHaveTextContent('Umumiy reyting')
  expect(dialog).toHaveTextContent('Guruhdagi o‘rni')
  expect(dialog).toHaveTextContent('Imtihonlar')
  expect(dialog).toHaveTextContent('Davomat')
  expect(dialog).toHaveTextContent('Uy vazifasi')
  expect(dialog).toHaveTextContent('Balans')
})

it('renders missing academic values without fake zeros', async () => {
  render(<StudentProfileDrawer studentId="s-without-summary" onClose={vi.fn()} onEdit={vi.fn()} />)
  expect(await screen.findByText('Ma’lumot yetarli emas')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test and confirm RED**

```powershell
corepack pnpm --filter @golden-study/web exec vitest run src/studentProfileDrawer.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement focused drawer**

Component requirements:

```ts
type StudentProfileDrawerProps = {
  studentId: string
  onClose: () => void
  onEdit: (studentId: string) => void
}
```

Structure:

```tsx
<>
  <button className="student-profile-backdrop" aria-label="O‘quvchi kartasini yopish" onClick={onClose} />
  <aside className="student-profile-drawer" role="dialog" aria-modal="true" aria-labelledby="student-profile-title">
    <header>{/* name, code, status, close */}</header>
    <div className="student-profile-body">
      <section className="student-profile-metrics">{/* five labeled metrics */}</section>
      <section>{/* balance */}</section>
      <dl>{/* phone, parent, parent phone, address, groups */}</dl>
    </div>
    <footer>
      <button className="secondary-button" onClick={onClose}>Yopish</button>
      <button className="primary-button" onClick={() => onEdit(studentId)}>Tahrirlash</button>
    </footer>
  </aside>
</>
```

Use `null` → `Ma’lumot yetarli emas`; do not render `0%`.

- [ ] **Step 4: Add responsive CSS**

Desktop:

```css
.student-profile-drawer {
  position: fixed;
  z-index: 80;
  top: 0;
  right: 0;
  width: min(400px, 100%);
  height: 100dvh;
  overflow: auto;
}
.student-profile-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
```

Mobile:

```css
@media (max-width: 760px) {
  .student-profile-drawer { width: 100%; }
  .student-profile-drawer footer { position: sticky; bottom: 0; }
}
```

Add visible `:hover` and `:focus-visible` states.

- [ ] **Step 5: Run component test**

```powershell
corepack pnpm --filter @golden-study/web exec vitest run src/studentProfileDrawer.test.tsx
```

Expected: PASS.

### Task 3: Integrate drawer into students registry

**Files:**
- Modify: `apps/web/src/pages/StudentsPage.tsx`
- Modify: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `StudentProfileDrawer`.
- Produces: row click/keyboard opening and edit handoff.

- [ ] **Step 1: Extend App integration test**

Add assertions to the students registry test:

```tsx
const row = await screen.findByRole('row', { name: /ST101/ })
await user.click(row)
expect(await screen.findByRole('dialog', { name: 'Sardor Abdullayev' })).toBeInTheDocument()
expect(screen.getByRole('searchbox', { name: 'O‘quvchi qidirish' })).toHaveValue('')

await user.click(screen.getByRole('button', { name: 'ST101 amallari' }))
expect(screen.getAllByRole('dialog')).toHaveLength(1)

await user.click(screen.getByRole('button', { name: 'Yopish' }))
expect(screen.queryByRole('dialog', { name: 'Sardor Abdullayev' })).not.toBeInTheDocument()
```

- [ ] **Step 2: Run test and confirm RED**

```powershell
corepack pnpm --filter @golden-study/web exec vitest run src/App.test.tsx -t "открывает реестр учеников"
```

Expected: FAIL because row does not open profile.

- [ ] **Step 3: Add selected profile state and row behavior**

```ts
const [profileStudentId, setProfileStudentId] = useState<string | null>(null)
```

For each row:

```tsx
<tr
  key={s.id}
  tabIndex={0}
  aria-label={`${s.code} ${s.firstName} ${s.lastName}`}
  onClick={() => setProfileStudentId(s.id)}
  onKeyDown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setProfileStudentId(s.id)
    }
  }}
>
```

On the `…` button call `event.stopPropagation()` before existing dropdown logic.

Render:

```tsx
{profileStudentId ? (
  <StudentProfileDrawer
    studentId={profileStudentId}
    onClose={() => setProfileStudentId(null)}
    onEdit={(studentId) => {
      const student = students.find((item) => item.id === studentId)
      if (student) setEditing(student)
      setProfileStudentId(null)
    }}
  />
) : null}
```

- [ ] **Step 4: Handle Escape and focus**

In drawer:

```ts
useEffect(() => {
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
  }
  window.addEventListener('keydown', closeOnEscape)
  return () => window.removeEventListener('keydown', closeOnEscape)
}, [onClose])
```

Focus the close button on open. Store and restore `document.activeElement` on cleanup.

- [ ] **Step 5: Run integration tests**

```powershell
corepack pnpm --filter @golden-study/web exec vitest run src/App.test.tsx src/studentProfileDrawer.test.tsx
```

Expected: PASS.

### Task 4: Verification and project log

**Files:**
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1: Run focused tests**

```powershell
corepack pnpm --filter @golden-study/web exec vitest run src/studentProfileRepository.test.ts src/studentProfileDrawer.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full checks**

```powershell
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

Expected: all exit code `0`; Vite chunk warning may remain.

- [ ] **Step 3: Update progress**

Append date, completed behavior, exact changed files, test counts, commands and next backend step:

```markdown
## 2026-07-18 — карточка ученика

- Добавлен responsive drawer с академической, финансовой и контактной сводкой.
- Данные идут через StudentProfileRepository; UI не рассчитывает агрегаты.
- Проверки: ...
- Далее: согласовать GET /students/:id/profile перед API-интеграцией.
```

- [ ] **Step 4: Review diff**

```powershell
git diff --check
git diff --stat
```

Expected: no whitespace errors; only scoped files changed.
