# Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать тестируемый production-oriented фундамент Express API без подключения frontend и бизнес-модулей.

**Architecture:** `app.ts` собирает middleware и routes без открытия порта; `server.ts` управляет запуском и graceful shutdown. Конфигурация, HTTP-ответы, ошибки и health-модуль разделены по ответственности.

**Tech Stack:** Node.js, Express 5, TypeScript ESM, Zod, Prisma, Pino, Helmet, CORS, Swagger UI, Vitest, Supertest, ESLint.

## Global Constraints

- API prefix: `/api/v1`.
- Frontend и его repository bindings не изменять.
- Docker не добавлять.
- PostgreSQL не должен быть нужен для health-тестов.
- Секреты и персональные данные не логировать.
- TypeScript strict; `any` не использовать.
- Все runtime-входы валидировать через Zod.

---

### Task 1: API Toolchain and Environment

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/eslint.config.js`
- Create: `apps/api/src/config/env.test.ts`
- Create: `apps/api/src/config/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `loadEnv(source?: NodeJS.ProcessEnv): AppEnv`
- Produces: `env: AppEnv`

- [ ] **Step 1: Add dependencies and scripts**

Add Express, Zod, Prisma, Pino, security, Swagger, Vitest, Supertest, TypeScript and ESLint dependencies through `pnpm --filter @golden-study/api add`.

- [ ] **Step 2: Write failing env tests**

Test valid parsing, missing secrets and invalid port:

```ts
expect(loadEnv(validEnv).API_PORT).toBe(3000);
expect(() => loadEnv({ ...validEnv, JWT_ACCESS_SECRET: '' })).toThrow();
expect(() => loadEnv({ ...validEnv, API_PORT: 'invalid' })).toThrow();
```

- [ ] **Step 3: Run RED**

Run: `corepack pnpm --filter @golden-study/api test -- src/config/env.test.ts`

Expected: FAIL because `env.ts` does not exist.

- [ ] **Step 4: Implement typed environment**

Create a strict Zod schema with `NODE_ENV`, `API_PORT`, `FRONTEND_URL`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and optional `TELEGRAM_BOT_TOKEN`.

- [ ] **Step 5: Run GREEN**

Run: `corepack pnpm --filter @golden-study/api test -- src/config/env.test.ts`

Expected: 3 tests pass.

### Task 2: HTTP Contract and Application

**Files:**
- Create: `apps/api/src/common/errors/api-error.ts`
- Create: `apps/api/src/common/http/api-response.ts`
- Create: `apps/api/src/config/logger.ts`
- Create: `apps/api/src/config/swagger.ts`
- Create: `apps/api/src/middlewares/not-found.middleware.ts`
- Create: `apps/api/src/middlewares/error.middleware.ts`
- Create: `apps/api/src/modules/health/health.controller.ts`
- Create: `apps/api/src/modules/health/health.routes.ts`
- Create: `apps/api/src/app.test.ts`
- Create: `apps/api/src/app.ts`

**Interfaces:**
- Produces: `createApp(): Express`
- Produces: `ApiError`
- Produces: `successResponse<T>(data: T)`

- [ ] **Step 1: Write failing HTTP integration tests**

Verify:

```ts
expect((await request(createApp()).get('/api/v1/health')).body)
  .toEqual({ success: true, data: { status: 'ok' } });

expect((await request(createApp()).get('/missing')).body)
  .toEqual({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
```

- [ ] **Step 2: Run RED**

Run: `corepack pnpm --filter @golden-study/api test -- src/app.test.ts`

Expected: FAIL because application modules do not exist.

- [ ] **Step 3: Implement minimal application**

Build Express app with disabled `x-powered-by`, JSON limit, Helmet, restricted CORS, Pino HTTP, health route, Swagger route, 404 middleware and error middleware.

- [ ] **Step 4: Run GREEN**

Run: `corepack pnpm --filter @golden-study/api test -- src/app.test.ts`

Expected: health and 404 tests pass.

### Task 3: Prisma and Process Lifecycle

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/config/prisma.ts`
- Create: `apps/api/src/server.ts`

**Interfaces:**
- Produces: singleton `prisma`
- Consumes: `createApp()` and `env.API_PORT`

- [ ] **Step 1: Add minimal Prisma schema**

Use PostgreSQL datasource and generated Prisma Client without business models.

- [ ] **Step 2: Generate Prisma Client**

Run: `corepack pnpm --filter @golden-study/api prisma:generate`

Expected: Prisma Client generation succeeds.

- [ ] **Step 3: Implement server lifecycle**

Start HTTP server on configured port. Handle `SIGINT` and `SIGTERM`, close HTTP server, disconnect Prisma, and exit with correct code.

- [ ] **Step 4: Verify compilation**

Run: `corepack pnpm --filter @golden-study/api typecheck`

Expected: exit code 0.

### Task 4: Verification and Work Log

**Files:**
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1: Run targeted checks**

```powershell
corepack pnpm --filter @golden-study/api test
corepack pnpm --filter @golden-study/api lint
corepack pnpm --filter @golden-study/api typecheck
corepack pnpm --filter @golden-study/api build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run workspace checks**

```powershell
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

Expected: all commands exit 0; known Vite chunk warning is allowed.

- [ ] **Step 3: Update progress**

Record date, scope, changed files, exact checks and next step: Prisma business schema + Auth/RBAC.

- [ ] **Step 4: Review diff**

Run:

```powershell
git diff --check
git status --short
```

Confirm no unrelated files were modified by this implementation.
