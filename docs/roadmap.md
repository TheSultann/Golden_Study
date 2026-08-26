# Roadmap

## 0. Фундамент

- Инициализировать pnpm monorepo.
- Настроить TypeScript, ESLint, Prettier, Vitest.
- Создать React + Vite приложение.
- Добавить router, providers, theme и базовый layout.
- Создать `packages/contracts` и слой repositories.
- Настроить CI: lint, typecheck, test, build.

Результат: приложение запускается, проверки проходят, архитектурные границы готовы.

## 1. Frontend на моках

Порядок модулей:

1. Авторизация и роли.
2. Dashboard.
3. Преподаватели и курсы.
4. Комнаты, группы и расписание.
5. Студенты.
6. Посещаемость.
7. Лиды.
8. Финансы и KPI.
9. Экзамены.
10. Объявления, отчёты и настройки.

Для каждого модуля: контракт -> mock repository -> UI -> unit/component tests.

## 2. Backend

- Создать Express-приложение и Prisma schema.
- Реализовать auth, refresh tokens и RBAC.
- Реализовать модули в порядке frontend.
- Добавить OpenAPI, validation, audit и integration tests.

## 3. Постепенная интеграция

Для каждого модуля:

1. Согласовать и зафиксировать API-контракт.
2. Реализовать endpoint и integration tests.
3. Реализовать HTTP repository.
4. Запустить contract и UI tests.
5. Переключить модуль на API.
6. Удалить только его mock implementation.

## 4. Telegram

- Redis и BullMQ.
- Привязка родителя к студенту.
- Push-уведомления и команды меню.
- Retry, backoff, idempotency и notification log.

## 5. Подготовка релиза

- Полные e2e-тесты.
- Security и performance review.
- Backup/restore БД.
- Docker и окружения staging/production.
- Мониторинг, CI/CD и документация эксплуатации.
