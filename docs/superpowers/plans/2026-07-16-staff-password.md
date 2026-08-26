# Staff Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить безопасное создание начального пароля сотрудника.

**Architecture:** Create-input отделён от публичной модели `StaffMember`. Пароль существует только в форме и POST-запросе, не хранится в списке и не возвращается repository.

**Tech Stack:** React, TypeScript, Zod, TanStack Query, Vitest.

## Global Constraints

- Пароль минимум 8 символов и совпадает с подтверждением.
- Редактирование сотрудника не показывает текущий пароль.
- Бизнес-модель списка не содержит password/passwordHash.

---

### Task 1: Контракт и repository

**Files:** `packages/contracts/src/staff.ts`, `apps/web/src/features/staff/*`

- [ ] Добавить failing-тест create-формы и запустить Vitest.
- [ ] Ввести `StaffCreateInput`, отдельные `create` и `update` repository-методы.
- [ ] Проверить targeted Vitest.

### Task 2: Форма и UX

**Files:** `apps/web/src/pages/StaffPage.tsx`, `apps/web/src/App.test.tsx`

- [ ] Добавить пароль, подтверждение, show/hide и ошибку несовпадения.
- [ ] Не показывать пароль при редактировании.
- [ ] Проверить создание сотрудника и responsive modal в браузере.

### Task 3: Финальная проверка

**Files:** `docs/PROGRESS.md`

- [ ] Запустить test, lint, typecheck, build.
- [ ] Обновить журнал работы.
