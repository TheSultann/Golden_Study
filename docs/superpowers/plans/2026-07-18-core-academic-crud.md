# Core Academic CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать PostgreSQL CRUD и OpenAPI для Courses, Rooms, Teachers, Groups и Students без подключения frontend.

**Architecture:** Каждый домен имеет shared Zod contracts, controller, service и Prisma repository. Общие pagination/query helpers переиспользуются; RBAC и teacher scope применяются server-side.

**Tech Stack:** Express 5, TypeScript, Prisma/PostgreSQL, Zod 4, Vitest/Supertest, OpenAPI 3.1.

## Global Constraints

- Docker и frontend не изменять.
- Single-center, без `branch_id`.
- Integer UZS, без изменяемых balance fields.
- Default lesson duration 90; allowed 60/90/120/150/180.
- Delete означает deactivate/archive.
- Каждый behavior: RED → GREEN.

---

### Task 1: Contracts, Pagination and Migration

**Files:** `packages/contracts/src/core-api.ts`, `packages/contracts/src/index.ts`, `apps/api/src/common/http/pagination.ts`, `apps/api/prisma/schema.prisma`, new migration.

- [ ] Добавить failing tests для pagination, strict DTO и lesson duration.
- [ ] Реализовать shared query/create/update/response schemas.
- [ ] Добавить `lessonDurationMinutes` и `StudentCodeCounter`.
- [ ] Создать/apply migration в dev/test.

### Task 2: Courses and Rooms

**Files:** `apps/api/src/modules/courses/*`, `apps/api/src/modules/rooms/*`, `apps/api/src/app.ts`.

- [ ] Добавить failing integration tests CRUD, pagination, search, duplicate и deactivate conflict.
- [ ] Реализовать Courses repository/service/controller/routes.
- [ ] Реализовать Rooms repository/service/controller/routes.
- [ ] Подключить `ADMIN|SUPER_ADMIN` write и authenticated read.
- [ ] Запустить targeted tests.

### Task 3: Teachers

**Files:** `apps/api/src/modules/teachers/*`.

- [ ] Добавить failing tests salary validation, transactional Teacher+User create и deactivate restriction.
- [ ] Реализовать repository/service/controller/routes.
- [ ] Добавить own-profile/own-groups scope для Teacher.
- [ ] Запустить targeted tests.

### Task 4: Groups and Schedule Conflicts

**Files:** `apps/api/src/modules/groups/*`.

- [ ] Добавить failing unit tests end date и interval overlap.
- [ ] Добавить failing integration tests CRUD, inactive dependency, teacher/room conflicts и ownership.
- [ ] Реализовать serializable create/update и archive.
- [ ] Запустить targeted tests.

### Task 5: Students and Memberships

**Files:** `apps/api/src/modules/students/*`.

- [ ] Добавить failing tests atomic `ST101+`, CRUD, freeze/unfreeze/archive.
- [ ] Добавить failing tests membership add/remove/graduate/history/duplicate.
- [ ] Реализовать transaction-safe student counter и membership transitions.
- [ ] Добавить teacher scoped reads.
- [ ] Запустить targeted tests.

### Task 6: OpenAPI and Verification

**Files:** `apps/api/src/config/swagger.ts`, `apps/api/src/config/swagger.test.ts`, `docs/PROGRESS.md`.

- [ ] Добавить failing OpenAPI path/schema assertions.
- [ ] Документировать все CRUD endpoint.
- [ ] Выполнить Prisma validate/status, API и workspace test/lint/typecheck/build.
- [ ] Обновить `docs/PROGRESS.md`.
