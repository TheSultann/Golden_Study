# Auth and Courses API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подключить реальную backend-авторизацию и Courses CRUD, затем удалить только course mocks после полной проверки.

**Architecture:** Единый HTTP client хранит access token в памяти, делает один refresh при `401` и повторяет запрос. Auth service управляет runtime session. `ApiCourseRepository` адаптирует API DTO к существующей UI-модели; binding переключается без изменения страницы.

**Tech Stack:** React 19, TypeScript strict, TanStack Query 5, Zod 4, Vitest, Express API.

## Global Constraints

- ТЗ и server-side RBAC не менять.
- Access token не хранить в `localStorage`.
- Refresh token использовать только через `httpOnly` cookie.
- UI → TanStack Query hooks → Repository → ApiRepository.
- Остальные mocks не удалять.
- Новые зависимости не добавлять.

---

### Task 1: Общий HTTP client

**Files:**
- Create: `apps/web/src/shared/api/apiError.ts`
- Create: `apps/web/src/shared/api/httpClient.ts`
- Test: `apps/web/src/shared/api/httpClient.test.ts`

**Interfaces:**
- Produces: `ApiError`, `setAccessToken(token)`, `clearAccessToken()`, `apiRequest(path, init, schema)`.
- `apiRequest` добавляет Bearer/credentials, валидирует schema, делает один shared refresh и один retry.

- [ ] **Step 1: RED — тест Bearer, cookie, Zod**

Подменить `global.fetch`; вызвать `setAccessToken('access-1')`, затем `apiRequest('/courses', {}, schema)`. Проверить URL `${VITE_API_URL}/courses`, `credentials: 'include'`, Bearer и parsed result.

- [ ] **Step 2: Run RED**

Run: `corepack pnpm --filter @golden-study/web test -- src/shared/api/httpClient.test.ts`

Expected: FAIL — module `httpClient` отсутствует.

- [ ] **Step 3: GREEN — минимальный client**

Реализовать runtime token, base URL из `VITE_API_URL ?? 'http://localhost:3000/api/v1'`, JSON parsing и Zod generic.

- [ ] **Step 4: RED/GREEN — shared refresh**

Добавить тест двух конкурентных `401`: ожидается один `POST /auth/refresh`, оба исходных запроса повторены с новым Bearer. Реализовать module-level `refreshPromise`.

- [ ] **Step 5: RED/GREEN — error envelope**

Добавить тест `409` envelope `{ success:false,error:{code,message,details} }`; реализовать `ApiError(status, code, message, details)`.

- [ ] **Step 6: Run targeted**

Run: `corepack pnpm --filter @golden-study/web test -- src/shared/api/httpClient.test.ts`

Expected: PASS.

---

### Task 2: Реальный Auth lifecycle

**Files:**
- Modify: `apps/web/src/features/auth/auth.types.ts`
- Replace: `apps/web/src/features/auth/auth.service.ts`
- Modify: `apps/web/src/pages/LoginPage.tsx`
- Modify: `apps/web/src/routes/ProtectedRoute.tsx`
- Modify: `apps/web/src/routes/RoleRoute.tsx`
- Modify: `apps/web/src/widgets/app-shell/AppShell.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/features/auth/auth.service.test.ts`
- Test: `apps/web/src/authFlow.test.tsx`

**Interfaces:**
- Produces: `login(credentials): Promise<AuthUser>`, `restoreSession(): Promise<AuthUser|null>`, `logout(): Promise<void>`, `getSession(): AuthUser|null`.
- UI role остаётся `'admin' | 'teacher'`; API `SUPER_ADMIN|ADMIN` маппятся в `admin`.

- [ ] **Step 1: RED — login mapping**

Тест: backend auth envelope с `ADMIN` сохраняет user в памяти, выставляет access token, не пишет auth session в `localStorage`.

- [ ] **Step 2: Run RED**

Run: `corepack pnpm --filter @golden-study/web test -- src/features/auth/auth.service.test.ts`

Expected: FAIL — текущий sync mock auth.

- [ ] **Step 3: GREEN — auth service**

Использовать `loginRequestSchema`, `authResponseSchema`, `refreshResponseSchema`, `authUserSchema`. Реализовать async login/restore/logout и role adapter.

- [ ] **Step 4: RED — protected restore**

Component test: без runtime user route показывает loading, успешный refresh + `/auth/me` открывает content; неуспех ведёт `/login`.

- [ ] **Step 5: GREEN — routes/UI**

`ProtectedRoute` выполняет одно restore attempt. `LoginPage` await login, disabled submit во время req, backend message в alert. AppShell await logout. Role consumers читают runtime session.

- [ ] **Step 6: Run auth tests**

Run: `corepack pnpm --filter @golden-study/web test -- src/features/auth/auth.service.test.ts src/authFlow.test.tsx`

Expected: PASS.

---

### Task 3: Courses contract adapter и repository

**Files:**
- Modify: `packages/contracts/src/courses.ts`
- Modify: `apps/web/src/features/courses/course.repository.ts`
- Replace: `apps/web/src/features/courses/apiCourse.repository.ts`
- Modify: `apps/web/src/features/courses/useCourses.ts`
- Test: `apps/web/src/features/courses/apiCourse.repository.test.ts`

**Interfaces:**
- Consumes: `apiRequest`.
- Produces: существующий `CourseRepository`, но create принимает UI Course без использования frontend-generated ID.

- [ ] **Step 1: RED — list mapping**

API `{success:true,data:[CourseApi],meta}` должен стать UI `Course[]`: `pricePerMonthUzs → pricePerMonth`, `isActive → active`.

- [ ] **Step 2: Run RED**

Run: `corepack pnpm --filter @golden-study/web test -- src/features/courses/apiCourse.repository.test.ts`

Expected: FAIL — старые schemas/envelope не совпадают.

- [ ] **Step 3: GREEN — response schemas и adapter**

Добавить paginated/resource schemas вокруг `courseApiSchema`; parse строго на API boundary; адаптировать DTO.

- [ ] **Step 4: RED/GREEN — create/update payload**

Проверить exact JSON: `title`, `description`, `durationMonths`, `pricePerMonthUzs`; без `id`, counts, active. PATCH использует `/courses/{uuid}`.

- [ ] **Step 5: RED/GREEN — deactivate**

Проверить `DELETE /courses/{uuid}`, response `204`; попытка `active=true` должна дать явную unsupported error, потому backend не имеет reactivate endpoint.

- [ ] **Step 6: GREEN — hook create**

Убрать генерацию `c-${Date.now()}`. Repository сам различает create/update через отдельные методы.

- [ ] **Step 7: Run targeted**

Run: `corepack pnpm --filter @golden-study/web test -- src/features/courses/apiCourse.repository.test.ts`

Expected: PASS.

---

### Task 4: Binding, regression, mock removal

**Files:**
- Modify: `apps/web/src/features/courses/course.dependencies.ts`
- Delete after QA: `apps/web/src/features/courses/mockCourse.repository.ts`
- Delete after QA: `apps/web/src/mocks/courses.ts`
- Modify tests importing course mocks
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- `courseRepository = new ApiCourseRepository(apiUrl)`.

- [ ] **Step 1: RED — binding test**

Добавить test/inspection assertion, что production binding не импортирует `MockCourseRepository`.

- [ ] **Step 2: GREEN — switch binding**

Создать `ApiCourseRepository(import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1')`.

- [ ] **Step 3: Targeted/full automated verification**

Run:

```powershell
corepack pnpm --filter @golden-study/web test
corepack pnpm --filter @golden-study/web lint
corepack pnpm --filter @golden-study/web typecheck
corepack pnpm --filter @golden-study/web build
corepack pnpm --filter @golden-study/api test
```

Expected: exit `0`; no failed tests.

- [ ] **Step 4: Browser QA**

Проверить `http://localhost:5173`: login, reload restore, courses list/create/edit/deactivate, `409`, logout; desktop `1440×900`, mobile `390×844`; console без новых ошибок.

- [ ] **Step 5: Delete course mocks**

Удалить два course mock файла только после Step 3–4. Исправить только связанные imports/tests.

- [ ] **Step 6: Fresh final verification**

Run:

```powershell
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

Expected: exit `0`; известное Vite chunk warning допустимо.

- [ ] **Step 7: Progress**

Добавить дату, сделанное, точные файлы, команды/результаты, следующий модуль в `docs/PROGRESS.md`.

