# Finance Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Разделить финансовые операции и read-only отчёты без дублирования.

**Architecture:** `FinanceRepository` остаётся единой границей данных. `FinancePage` выполняет операции, `ReportsPage` читает агрегаты и задолженности.

**Tech Stack:** React, TypeScript, TanStack Query, Zod, Vitest.

---

### Task 1: Контракты операций
- [ ] Добавить отдельные input-типы платежа и расхода в `finance.repository.ts`.
- [ ] Реализовать обе операции в mock repository с записью в журнал.
- [ ] Добавить mutations и invalidation.

### Task 2: UI Moliya
- [ ] Оставить вкладки `To‘lovlar`, `Xarajatlar`, `Oyliklar`, `Operatsiyalar`.
- [ ] Заменить универсальную форму отдельными формами платежа и расхода.
- [ ] Удалить редактирование из журнала операций.

### Task 3: UI Hisobotlar
- [ ] Создать read-only страницу с вкладками из раздела 6.12 ТЗ.
- [ ] Перенести задолженности и сводный `Kirim-chiqim` из `Moliya`.
- [ ] Подключить маршрут `/reports`.

### Task 4: Проверка
- [ ] Добавить smoke-тесты форм и отчётов.
- [ ] Запустить `corepack pnpm test`, `lint`, `typecheck`, `build`.
- [ ] Обновить `docs/PROGRESS.md`.
