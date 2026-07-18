# Backend Foundation Design

## Цель

Подготовить изолированный production-oriented фундамент `apps/api` без подключения frontend и без реализации бизнес-модулей.

## Границы этапа

В этап входят:

- Express + TypeScript в строгом режиме;
- API prefix `/api/v1`;
- Zod-валидация environment variables;
- Prisma Client и базовая конфигурация PostgreSQL без бизнес-моделей;
- Pino HTTP logging без секретов и персональных данных;
- Helmet, CORS и базовые безопасные настройки Express;
- единый формат успешных ответов и ошибок;
- `GET /api/v1/health`;
- Swagger/OpenAPI для health endpoint;
- not-found и global error middleware;
- unit/integration-тесты;
- рабочие команды `dev`, `build`, `start`, `lint`, `typecheck`, `test`;
- обновление `.env.example` и `docs/PROGRESS.md`.

Не входят:

- подключение frontend;
- бизнес-схема Prisma и миграции;
- Auth/RBAC;
- Redis/BullMQ;
- Telegram;
- Docker;
- CRUD бизнес-модулей.

## Архитектура

Поток HTTP-запроса:

```text
Request → security/CORS/logging → routes → controller → response
                                 ↘ not-found/error middleware
```

`app.ts` создаёт Express-приложение без открытия порта, чтобы integration-тесты работали через Supertest. `server.ts` отвечает только за запуск и корректное завершение процесса. Конфигурация, ошибки, middleware и health-модуль разделены по одной ответственности.

## Структура

```text
apps/api/
  prisma/
    schema.prisma
  src/
    app.ts
    server.ts
    config/
      env.ts
      logger.ts
      prisma.ts
      swagger.ts
    common/
      errors/api-error.ts
      http/api-response.ts
    middlewares/
      error.middleware.ts
      not-found.middleware.ts
    modules/
      health/
        health.controller.ts
        health.routes.ts
    test/
      setup-env.ts
    app.test.ts
  eslint.config.js
  tsconfig.json
```

## API-контракт

`GET /api/v1/health` возвращает HTTP `200`:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

Неизвестный route возвращает HTTP `404`:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found"
  }
}
```

Необработанная ошибка возвращает предсказуемый ответ без stack trace. Подробности пишутся только в logger.

## Environment

Обязательные переменные проверяются при старте. Секреты не имеют небезопасных значений по умолчанию. Тесты задают собственное окружение до импорта приложения.

Для текущего этапа Prisma генерирует клиент, но приложение не требует доступной PostgreSQL для запуска health endpoint. Проверку реального соединения добавим вместе со схемой БД.

## Тестирование

TDD-порядок:

1. integration-тест health endpoint;
2. integration-тест 404;
3. unit-тест env validation;
4. build, lint, typecheck и полный workspace test.

Тесты не открывают сетевой порт и не требуют PostgreSQL.

## Решения

- Использовать Express 5 и ESM.
- Использовать Vitest, чтобы сохранить единый test runner monorepo.
- Использовать Pino/Pino HTTP.
- Использовать Swagger UI и программный OpenAPI-документ.
- Не добавлять абстрактные controller/service/repository слои без бизнес-логики.
- Не менять `apps/web` и существующие frontend-контракты.
