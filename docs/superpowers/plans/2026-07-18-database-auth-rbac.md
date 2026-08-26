# Database, Auth and RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать PostgreSQL schema, migration, seed, Auth/RBAC API и OpenAPI без подключения frontend и Docker.

**Architecture:** Shared Zod-контракты определяют HTTP payload. Auth-модуль использует controller → service → repository, production repository работает через Prisma, unit-тесты используют in-memory implementation; integration-тесты работают с отдельной PostgreSQL test DB.

**Tech Stack:** Express 5, TypeScript ESM, PostgreSQL 18, Prisma 6, Zod 4, bcryptjs, jsonwebtoken, cookie-parser, express-rate-limit, Vitest, Supertest, OpenAPI 3.0.

## Global Constraints

- Работать на `main` по явному разрешению пользователя.
- Docker не добавлять.
- Frontend не подключать и `apps/web` не изменять.
- API prefix: `/api/v1`.
- Refresh token хранить только в `httpOnly` cookie и hash в БД.
- Денежные значения хранить целым числом UZS.
- Балансы студента и преподавателя не хранить отдельным изменяемым полем.
- Single-center: `branch_id` и филиалы не добавлять.
- Миграции выполнять только через Prisma.
- Dev и test DB разделять.

---

### Task 1: Shared Auth Contracts and Dependencies

**Files:**
- Create: `packages/contracts/src/auth.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.env.example`
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/config/env.test.ts`
- Modify: `apps/api/src/test/setup-env.ts`

**Interfaces:**
- Produces: `loginRequestSchema`, `authUserSchema`, `authResponseSchema`, `refreshResponseSchema`, `sessionSchema`.
- Produces: seed password env fields and JWT TTL config.

- [ ] Write failing contract/env tests for normalized login payload, password minimum, token TTL and seed secrets.
- [ ] Run targeted tests and confirm failure because Auth schemas/env fields do not exist.
- [ ] Add shared Zod schemas and required dependencies: workspace contracts, bcryptjs, jsonwebtoken, cookie-parser, express-rate-limit and type packages.
- [ ] Add env fields `JWT_ACCESS_EXPIRES_IN_SECONDS=900`, `JWT_REFRESH_EXPIRES_IN_DAYS=30`, `BCRYPT_COST=12`, `SEED_*_PASSWORD`.
- [ ] Run targeted tests and confirm green.

### Task 2: Prisma Business Schema and Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/*/migration.sql`
- Create: `apps/api/prisma/migrations/migration_lock.toml`

**Interfaces:**
- Produces Prisma enums: `Role`, `SalaryType`, `Weekday`, `GroupStatus`, `StudentStatus`, `GroupStudentStatus`, `BillingMode`.
- Produces models: `User`, `RefreshToken`, `Teacher`, `Course`, `Room`, `Group`, `Student`, `GroupStudent`, `Settings`, `AuditLog`.

- [ ] Create local databases `golden_study` and `golden_study_test` when absent.
- [ ] Add Prisma models with UUID keys, indexes, integer UZS fields, UTC timestamps and explicit delete behavior.
- [ ] Run `prisma format` and `prisma validate`.
- [ ] Generate and inspect initial migration with `prisma migrate dev --name init_core_auth`.
- [ ] Apply migration to test DB using `prisma migrate deploy`.
- [ ] Regenerate Prisma Client and run typecheck.

### Task 3: Password and JWT Domain Services

**Files:**
- Create: `apps/api/src/modules/auth/password.service.test.ts`
- Create: `apps/api/src/modules/auth/password.service.ts`
- Create: `apps/api/src/modules/auth/token.service.test.ts`
- Create: `apps/api/src/modules/auth/token.service.ts`

**Interfaces:**
- Produces: `hashPassword(password): Promise<string>`.
- Produces: `verifyPassword(password, hash): Promise<boolean>`.
- Produces: `createAccessToken(user): string`.
- Produces: `createRefreshToken(userId, tokenId): string`.
- Produces: `verifyAccessToken(token): AccessTokenPayload`.
- Produces: `verifyRefreshToken(token): RefreshTokenPayload`.
- Produces: `hashRefreshToken(token): string`.

- [ ] Write failing password tests for hashing and correct/incorrect verification.
- [ ] Run RED, implement bcryptjs service, run GREEN.
- [ ] Write failing token tests for token type, role/teacher payload, expiry config and SHA-256 token hash.
- [ ] Run RED, implement JWT service, run GREEN.

### Task 4: Auth Repository and Service

**Files:**
- Create: `apps/api/src/modules/auth/auth.types.ts`
- Create: `apps/api/src/modules/auth/auth.repository.ts`
- Create: `apps/api/src/modules/auth/prisma-auth.repository.ts`
- Create: `apps/api/src/modules/auth/auth.service.test.ts`
- Create: `apps/api/src/modules/auth/auth.service.ts`

**Interfaces:**
- Produces: `AuthRepository` with user lookup, token creation/lookup/rotation/revocation and session listing.
- Produces: `AuthService.login`, `refresh`, `logout`, `getCurrentUser`, `listSessions`.

- [ ] Write failing service tests for valid login, generic invalid credentials, inactive user, refresh rotation, replay rejection and idempotent logout.
- [ ] Run RED.
- [ ] Implement repository interface and AuthService without Express/Prisma coupling.
- [ ] Implement Prisma repository using `$transaction` for refresh rotation.
- [ ] Run GREEN and typecheck.

### Task 5: Authentication and RBAC Middleware

**Files:**
- Create: `apps/api/src/common/types/express.d.ts`
- Create: `apps/api/src/middlewares/auth.middleware.test.ts`
- Create: `apps/api/src/middlewares/auth.middleware.ts`
- Create: `apps/api/src/middlewares/role.middleware.test.ts`
- Create: `apps/api/src/middlewares/role.middleware.ts`
- Create: `apps/api/src/modules/auth/teacher-ownership.test.ts`
- Create: `apps/api/src/modules/auth/teacher-ownership.ts`
- Modify: `apps/api/src/middlewares/error.middleware.ts`

**Interfaces:**
- Produces: `authenticate`.
- Produces: `requireRoles(...roles)`.
- Produces: `assertTeacherOwnership(currentUser, resourceTeacherId)`.

- [ ] Write failing middleware/policy tests for 401, blocked user, 403 role denial and teacher ownership.
- [ ] Run RED.
- [ ] Implement request user typing, authentication, RBAC and ownership policy.
- [ ] Map Zod/JWT/Prisma-safe errors into common envelopes without leaking internals.
- [ ] Run GREEN.

### Task 6: Auth HTTP API and Cookies

**Files:**
- Create: `apps/api/src/middlewares/validate.middleware.ts`
- Create: `apps/api/src/modules/auth/auth.cookies.ts`
- Create: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/auth/auth.routes.ts`
- Create: `apps/api/src/modules/auth/auth.integration.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces endpoints: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/sessions`.

- [ ] Write failing integration tests against `golden_study_test` for login cookie, refresh rotation/replay, logout, `/me`, inactive user and role restriction.
- [ ] Run RED.
- [ ] Implement Zod validation middleware, cookie helpers, controller/routes and Auth rate limit.
- [ ] Mount routes in `createApp` with injectable Auth dependencies for isolated tests.
- [ ] Run GREEN.

### Task 7: Seed

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Produces idempotent seed for Settings, users, teacher, courses, rooms, groups, students and memberships.

- [ ] Add seed integration test or verification query that records entity counts.
- [ ] Run seed twice.
- [ ] Verify counts are unchanged and passwords are hashes.
- [ ] Ensure seed never logs raw passwords.

### Task 8: OpenAPI

**Files:**
- Modify: `apps/api/src/config/swagger.ts`
- Create: `apps/api/src/config/swagger.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces OpenAPI JSON at `/api/openapi.json`.
- Documents health and all Auth endpoints, Bearer/cookie security schemes and response envelopes.

- [ ] Write failing test asserting all required paths/security schemes exist.
- [ ] Run RED.
- [ ] Build OpenAPI schemas from shared Zod contracts using Zod 4 JSON schema conversion and explicit endpoint metadata.
- [ ] Run GREEN and verify Swagger UI serves the document.

### Task 9: Final Verification and Progress

**Files:**
- Modify: `docs/PROGRESS.md`

- [ ] Run Prisma validation, migration status and seed idempotency check.
- [ ] Run API test, lint, typecheck and build.
- [ ] Run workspace test, lint, typecheck and build.
- [ ] Run `git diff --check` and inspect scoped status.
- [ ] Record exact results and next step in `docs/PROGRESS.md`.
