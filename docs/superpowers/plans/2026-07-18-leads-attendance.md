# Leads and Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать production-oriented PostgreSQL API для Leads и Attendance без подключения frontend, Billing, Telegram и Docker.

**Architecture:** Shared Zod contracts определяют API DTO. Изолированные Express routes вызывают domain services; Prisma выполняет все переходы, conversion и bulk attendance в транзакциях. RBAC и teacher ownership проверяются server-side.

**Tech Stack:** Express 5, TypeScript strict ESM, Prisma 6, PostgreSQL 18, Zod 4, Vitest, Supertest, OpenAPI 3.1.

## Global Constraints

- Источник правил: `Golden_Study-CRM-TZ.md`, `Eduxa_Backend_TZ.md`, утверждённый design.
- Single-center, без `branch_id`.
- Frontend остаётся на mock repositories.
- Финансовые записи/KPI/BullMQ не реализуются в этом этапе.
- Никаких физических удалений lead/attendance истории.
- Каждый production behavior проходит RED → GREEN.

---

### Task 1: Prisma schema and shared contracts

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_leads_attendance/migration.sql`
- Modify: `packages/contracts/src/core-api.ts`
- Test: `apps/api/src/modules/leads/lead.contract.test.ts`
- Test: `apps/api/src/modules/attendance/attendance.contract.test.ts`

**Interfaces:**
- Produces: Lead/Attendance Prisma models and Zod create/update/list/bulk schemas.

- [ ] Write failing contract tests for strict inputs, lead transitions, duplicate attendance student IDs, rating rules and date format.
- [ ] Run tests and confirm missing schemas fail.
- [ ] Add enums/models/relations/indexes, including unique `(groupId, studentId, date)`.
- [ ] Add shared API schemas/types and make tests pass.
- [ ] Create/apply migration to dev and test databases; generate Prisma Client.

### Task 2: Leads CRUD and conversion

**Files:**
- Create: `apps/api/src/modules/leads/lead.service.ts`
- Create: `apps/api/src/modules/leads/lead.routes.ts`
- Test: `apps/api/src/modules/leads/lead.integration.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces: `/api/v1/leads`, `/:id`, `/:id/status`, `/:id/convert`.

- [ ] Write failing integration tests for CRUD, filters, RBAC, archive, conversion and repeated conversion.
- [ ] Confirm 404 failures before routes exist.
- [ ] Implement admin-only CRUD with soft archive and active dependency validation.
- [ ] Implement Serializable Lead → Student conversion using atomic `StudentCodeCounter`; optional membership is in same transaction.
- [ ] Map duplicates/serialization conflicts to safe `409`; run targeted tests green.

### Task 3: Attendance domain rules

**Files:**
- Create: `apps/api/src/modules/attendance/attendance-policy.ts`
- Test: `apps/api/src/modules/attendance/attendance-policy.test.ts`

**Interfaces:**
- Produces: `attendanceOperationKey(id)`, `shouldChargeAttendance(status)`, membership-on-date predicate.

- [ ] Write failing unit tests for operation key, charge decision and membership date boundaries.
- [ ] Implement minimal pure functions.
- [ ] Run targeted unit tests green.

### Task 4: Attendance API

**Files:**
- Create: `apps/api/src/modules/attendance/attendance.service.ts`
- Create: `apps/api/src/modules/attendance/attendance.routes.ts`
- Test: `apps/api/src/modules/attendance/attendance.integration.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces: `/api/v1/attendance`, `/group/:groupId/date/:date`, `/:id`, `/students/:id/attendance`.

- [ ] Write failing integration tests for session load, bulk upsert, unique rows, teacher ownership, admin lock, correction and reversal.
- [ ] Confirm missing endpoint failures.
- [ ] Implement paginated list and session projection over active-on-date memberships.
- [ ] Implement transactional bulk upsert; admin sets lock, teacher cannot change locked rows.
- [ ] Implement admin correction and soft reversal; never physically delete.
- [ ] Add student attendance history with teacher scope; run targeted tests green.

### Task 5: OpenAPI and verification

**Files:**
- Modify: `apps/api/src/config/swagger.ts`
- Modify: `apps/api/src/config/swagger.test.ts`
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Produces: documented Leads/Attendance API at `/api/docs` and `/api/openapi.json`.

- [ ] Add failing assertions for every new path/schema.
- [ ] Document request, response, role and error contracts.
- [ ] Run contracts build, Prisma validate/status, API tests/lint/typecheck/build.
- [ ] Run workspace test/lint/typecheck/build; record exact results in `docs/PROGRESS.md`.
