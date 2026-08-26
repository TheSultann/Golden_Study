# Finance Ledger, Billing, Payments and KPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать immutable financial ledger, payments, DAILY/MONTHLY billing, KPI, payouts и finance projections.

**Architecture:** LedgerEntry — единственный источник истины. Billing, payment, KPI, payout и reversal services создают неизменяемые записи в Serializable transactions с unique operation keys. Балансы, долги и summary вычисляются запросами ledger.

**Tech Stack:** Express 5, TypeScript strict ESM, Prisma/PostgreSQL, Decimal.js через Prisma Decimal, Zod, Vitest/Supertest, OpenAPI 3.1.

## Global Constraints

- Money: positive integer UZS; float запрещён.
- Intermediate KPI: Decimal; final mathematical rounding to integer UZS.
- Старые financial rows не update/delete.
- Все writes создают AuditLog.
- `operationKey` unique; retries безопасны.
- Frontend, Redis/BullMQ, Telegram и Docker вне scope.
- Каждый behavior проходит RED → GREEN.

---

### Task 1: Ledger schema, contracts and pure calculations

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: Prisma migration
- Modify: `packages/contracts/src/core-api.ts`
- Create: `apps/api/src/modules/finance/finance-calculation.ts`
- Test: `apps/api/src/modules/finance/finance-calculation.test.ts`
- Test: `apps/api/src/modules/finance/finance.contract.test.ts`

**Interfaces:**
- Produces: LedgerEntry, Payment, BillingRun, StudentStatusPeriod and API schemas.
- Produces: lesson counting, daily/monthly charge, KPI calculations, operation keys.

- [ ] Write failing contract and unit tests: rounding, leap month, zero lessons, proration, KPI, signs, keys.
- [ ] Confirm missing schemas/functions fail.
- [ ] Add Prisma models/enums/constraints/indexes.
- [ ] Add strict shared Zod DTO and response schemas.
- [ ] Implement pure calculations; run tests green.
- [ ] Create/apply migration dev/test and generate client.

### Task 2: Ledger and Payments

**Files:**
- Create: `apps/api/src/modules/finance/ledger.service.ts`
- Create: `apps/api/src/modules/finance/payment.service.ts`
- Create: `apps/api/src/modules/finance/finance.routes.ts`
- Test: `apps/api/src/modules/finance/payment.integration.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces: `POST /payments/student`, `/payments/:id/reverse`, `GET /transactions`, `/transactions/:id/reverse`, `/students/:id/transactions`.

- [ ] Write failing integration tests for payment, idempotent key, computed balance, reversal, manual income/expense, RBAC and audit.
- [ ] Implement immutable LedgerService and admin routes.
- [ ] Implement Payment+Ledger atomic creation/reversal.
- [ ] Map duplicate/reversal conflicts to `409`; run targeted tests green.

### Task 3: Daily Billing with Attendance

**Files:**
- Create: `apps/api/src/modules/billing/billing.service.ts`
- Test: `apps/api/src/modules/billing/daily-billing.integration.test.ts`
- Modify: `apps/api/src/modules/attendance/attendance.service.ts`
- Create: `apps/api/src/modules/billing/billing.routes.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces: Attendance atomic charge/reversal and `POST /billing/daily/reconcile`.

- [ ] Write failing tests for CAME/ABSENT charge, EXCUSED no-op, repeated save, status change and soft reversal.
- [ ] Implement daily scheduled lesson calculation and charge creation in same transaction as Attendance.
- [ ] Add reconciliation for missing/stale attendance operations.
- [ ] Run targeted tests green.

### Task 4: Monthly Billing and Freeze History

**Files:**
- Create: `apps/api/src/modules/billing/monthly-billing.service.ts`
- Test: `apps/api/src/modules/billing/monthly-billing.integration.test.ts`
- Modify: `apps/api/src/modules/students/student.service.ts`
- Modify: `apps/api/src/modules/billing/billing.routes.ts`

**Interfaces:**
- Produces: StudentStatusPeriod history and `POST /billing/monthly/reconcile`, `GET /billing/runs`.

- [ ] Write failing tests for full month, join/remove/freeze proration, repeat no-op and correction delta.
- [ ] Record status periods transactionally during freeze/unfreeze/archive.
- [ ] Implement BillingRun lock and monthly reconciliation.
- [ ] Run targeted tests green.

### Task 5: KPI and Payouts

**Files:**
- Create: `apps/api/src/modules/kpi/kpi.service.ts`
- Create: `apps/api/src/modules/kpi/kpi.routes.ts`
- Test: `apps/api/src/modules/kpi/kpi.integration.test.ts`
- Modify: Attendance/daily and monthly billing orchestration.

**Interfaces:**
- Produces: KPI accrual/reversal and `/teachers/:id/kpi`, `/:id/payout`, payout reversal.

- [ ] Write failing tests for PERCENT/PER_STUDENT/FIXED, idempotency, charge reversal, payout limit and payout reversal.
- [ ] Implement Decimal KPI calculations and ledger entries in billing transactions.
- [ ] Implement computed payable and payout endpoints.
- [ ] Run targeted tests green.

### Task 6: Finance projections, OpenAPI and verification

**Files:**
- Create: `apps/api/src/modules/finance/finance-query.service.ts`
- Test: `apps/api/src/modules/finance/finance.integration.test.ts`
- Modify: `apps/api/src/config/swagger.ts`
- Modify: `apps/api/src/config/swagger.test.ts`
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Produces: `/finance/summary`, `/finance/debtors`, normalized transaction/payment/KPI responses and complete OpenAPI.

- [ ] Write failing tests for summary, debtors, filters, pagination and RBAC.
- [ ] Implement ledger projections without persisted balances.
- [ ] Add failing OpenAPI path/schema assertions, then document all endpoints.
- [ ] Run Prisma validate/status dev/test.
- [ ] Run API and workspace test/lint/typecheck/build; record exact results.
