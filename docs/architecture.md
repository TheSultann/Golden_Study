# Архитектура Golden Study CRM

## Цель

Модульная CRM одного учебного центра. Сначала frontend работает через mock-repositories. Затем каждый модуль отдельно переключается на реальные API без переписывания UI.

## Стек

- Frontend: React, Vite, TypeScript, React Router, TanStack Query, Zustand, Tailwind CSS, shadcn/ui.
- Backend: Node.js, Express.js, TypeScript, Prisma, PostgreSQL, Zod, OpenAPI.
- Bot: Telegraf, Redis, BullMQ.
- Тесты: Vitest, React Testing Library, Supertest, Playwright.
- Monorepo: pnpm workspaces.

Docker добавляется только при подготовке деплоя.

## Структура

```text
apps/
  web/
    src/
      app/              # bootstrap, providers, router
      pages/            # страницы маршрутов
      widgets/          # крупные блоки страниц
      features/         # пользовательские действия
      entities/         # доменные модели и UI сущностей
      shared/           # UI-kit, API client, config, utils
      mocks/            # mock repositories и fixtures
  api/
    src/
      app/              # Express bootstrap и middleware
      modules/          # доменные модули
      shared/           # общая инфраструктура
      config/           # типизированная конфигурация
    prisma/             # schema, migrations, seed
  bot/
    src/
      handlers/
      jobs/
      services/
packages/
  contracts/            # DTO, Zod-схемы, API-типы
  config/               # общие lint/TypeScript настройки
```

## Доменные модули

`auth`, `users`, `teachers`, `courses`, `rooms`, `groups`, `students`, `attendance`, `leads`, `finance`, `exams`, `announcements`, `telegram`, `reports`, `settings`, `audit`.

Модуль владеет своей бизнес-логикой. Прямой доступ к внутренним файлам другого модуля запрещён; взаимодействие идёт через публичный API модуля.

## Доступ к данным frontend

```text
Page/Feature -> Repository interface -> Mock repository
                                    -> HTTP repository
```

- UI не импортирует fixtures напрямую.
- Типы запросов и ответов берутся из `packages/contracts`.
- Реализация repository выбирается конфигурацией.
- После подключения endpoint удаляется только mock соответствующего модуля.

## Backend

Каждый модуль содержит route, controller, service, repository, schemas и tests. Controller отвечает только за HTTP. Service содержит бизнес-логику. Repository работает с Prisma.

Общий pipeline: request ID -> security middleware -> auth -> RBAC -> validation -> controller -> error handler -> audit/logging.

## Финансы

- Суммы — целые UZS.
- Баланс вычисляется из неизменяемого финансового журнала.
- Операции выполняются транзакционно и идемпотентно.
- Исправления оформляются обратной операцией или корректировкой.
- KPI рассчитывается через Decimal и округляется до целого UZS.

## Тестирование

- Unit: бизнес-правила, hooks, utilities.
- Component: формы и сложные UI-состояния.
- Contract: mock и HTTP repository соответствуют одной схеме.
- Integration: Express + PostgreSQL для API и RBAC.
- E2E: критичные пользовательские сценарии.

## Решения

- Один учебный центр; филиалы отсутствуют.
- UI-даты: `DD.MM.YYYY`; API: ISO 8601; время БД: UTC.
- Основной язык UI: узбекский, латиница.
- Telegram и тяжёлые задачи выполняются через очередь.
