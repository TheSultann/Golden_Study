# AGENTS.md

Инструкции для ИИ-агентов, работающих с этим репозиторием.

## Стиль общения

- Отвечай коротко и по делу.
- Всегда работай профессионально, как senior-разработчик; проект не MVP, решения должны быть production-ready.
- Не пушь изменения без прямой команды пользователя.
- Не коммить без прямой команды пользователя.
- Не удаляй и не откатывай чужие изменения без разрешения.

## Проект

- Frontend: React + Vite, корень проекта.
- Backend: Express + MongoDB + Redis, папка `Backend/`.
- Production backend отдает frontend из `dist/`.
- Render должен запускаться из корня проекта.

## Project Structure

- `src/` — frontend React app.
- `src/pages/` — page-level screens.
- `src/components/` — reusable UI components.
- `src/api.js` — shared Axios client.
- `Backend/` — backend Express app.
- `Backend/app.js` — Express app, middleware, routes.
- `Backend/server.js` — Mongo connection, scheduler startup, port listen.
- `Backend/config/` — backend configuration helpers.
- `Backend/routes/` — API route handlers.
- `Backend/models/` — Mongoose models.
- `Backend/middleware/` — auth, cache, error, performance middleware.
- `Backend/queues/` — BullMQ queue setup.
- `Backend/jobs/` — scheduled backend jobs.
- `Backend/tests/` — backend integration tests.
- `render.yaml` — Render deployment config.
- `.github/workflows/` — CI config.

## Важные команды

Frontend:

```bash
npm run build
```

Backend tests:

```bash
cd Backend
npm test
```

Render build:

```bash
npm run render-build
```

Render start:

```bash
npm start
```

## Backend архитектура

- `Backend/app.js` содержит Express app и routes.
- `Backend/server.js` только подключает MongoDB, запускает scheduler и слушает порт.
- `Backend/config/env.js` отвечает за env validation и Redis disable logic.
- Не добавляй route logic в `server.js`.
- Новые API routes добавляй в `Backend/routes/`.
- Новые модели добавляй в `Backend/models/`.

## Тесты

- Backend тесты используют:
  - Jest
  - Supertest
  - mongodb-memory-server
- Тесты лежат в `Backend/tests/`.
- Для finance/evaluations обязательно покрывать:
  - роли доступа;
  - создание;
  - обновление;
  - отсутствие дублей;
  - правильные суммы/оценки.
- Перед заявлением, что backend работает, запускай:

```bash
cd Backend
npm test
```

## Секреты и env

- Не вставляй реальные секреты в код, README или тесты.
- `Backend/.env` не трогай без необходимости.
- Для примера используй `Backend/.env.example`.
- В тестах используй тестовые env values.

## Redis

- Redis не должен валить приложение в тестах.
- Если Redis недоступен, API должен продолжать работать без cache/queue.
- Для тестов используй:

```env
REDIS_DISABLED=true
NODE_ENV=test
```

## Render

- Render config лежит в `render.yaml`.
- Не меняй live Render настройки без прямой команды пользователя.
- После изменения deploy config локально проверь:

```bash
npm run build
cd Backend
npm test
```

## Frontend

- Соблюдай текущий CSS Modules стиль.
- Не ломай role-based routing в `src/App.jsx`.
- Для student empty state показывай нормальный UI, а не голый 404/пустой текст.

## Git

- Работай локально, пока пользователь не попросит push.
- Перед финальным ответом покажи, какие файлы изменены.
- Не запускай `git reset --hard` и не откатывай файлы без разрешения.
