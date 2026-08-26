# Teacher Panel Foundation Implementation Plan

**Goal:** Add the first safe, backend-ready teacher panel slice.

**Architecture:** Use role-aware routing and a dedicated teacher dashboard module. Keep data behind TanStack Query and a replaceable repository binding.

**Tech Stack:** React, TypeScript, React Router, TanStack Query, Zod, Vitest.

## Tasks

- [x] Add failing integration tests for teacher login, navigation, dashboard, and admin-route denial.
- [x] Replace the demo student role with teacher and add route-level RBAC.
- [x] Add teacher dashboard contracts, repository, mock/API implementations, hook, and page.
- [x] Run tests, lint, typecheck, build, and update `docs/PROGRESS.md`.
