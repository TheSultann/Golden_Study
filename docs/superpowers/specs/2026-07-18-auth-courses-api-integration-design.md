# Auth and Courses API Integration Design

## Цель

Подключить frontend к реальной backend-авторизации, затем перевести модуль `Kurslar` с `MockCourseRepository` на `ApiCourseRepository`. UI и бизнес-правила не менять. После полной проверки удалить только course mocks.

## Границы этапа

- Реальные endpoint: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, Courses CRUD.
- Access token хранится только в памяти.
- Refresh token хранится backend в `httpOnly` cookie.
- Остальные frontend-модули остаются на mock repositories.
- Новые зависимости не добавляются.

## Архитектура Auth

Frontend получает единый HTTP client. Он:

- добавляет `Authorization: Bearer <accessToken>`;
- всегда использует `credentials: include`;
- при первом `401` выполняет один refresh и повторяет исходный запрос;
- не запускает параллельные refresh-запросы;
- после неуспешного refresh очищает сессию;
- преобразует backend error envelope в типизированную frontend-ошибку;
- передаёт JSON в Zod-схему на границе repository.

Login сохраняет access token только в runtime auth store. При перезагрузке `ProtectedRoute` сначала пытается восстановить сессию через refresh, затем загружает `/auth/me`. Logout отзывает refresh session на backend и очищает runtime state.

## Интеграция Courses

Существующий поток сохраняется:

`CoursesPage → TanStack Query hooks → CourseRepository → ApiCourseRepository`

`ApiCourseRepository` использует общий HTTP client и адаптер между frontend и API:

- `pricePerMonth` ↔ `pricePerMonthUzs`;
- `active` ↔ `isActive`;
- API timestamps не передаются в UI-модель;
- create/update отправляют только разрешённые input-поля;
- deactivate вызывает `DELETE /courses/{id}`;
- list читает пагинированный envelope и запрашивает `limit=100`, пока UI не получит отдельную серверную пагинацию.

Dependency binding переключается на `ApiCourseRepository`. UI и Query hooks сохраняют публичный контракт. Генерация временного course ID во frontend прекращается: UUID создаёт backend.

## Ошибки и состояния

- `401`: один refresh + retry.
- Неуспешный refresh: переход к login.
- `403`: сообщение об отсутствии доступа.
- `409`: backend message, включая дубликат названия и активные группы.
- Ошибка сети или невалидный JSON/Zod: контролируемая repository error; TanStack Query показывает существующее error state.
- Mutation success: invalidation `['courses']`.

## TDD и проверка

Сначала failing tests:

1. login/refresh/logout и восстановление сессии;
2. один refresh для конкурентных `401`;
3. Course API → UI mapping;
4. create/update payload;
5. deactivate через `DELETE`;
6. backend error propagation;
7. dependency binding использует API.

После GREEN:

- targeted tests;
- web tests, lint, typecheck, build;
- API regression;
- browser QA: login, список, создание, изменение, деактивация, error state;
- desktop и mobile;
- удалить `mockCourse.repository.ts` и `mocks/courses.ts`;
- повторить полные проверки;
- обновить `docs/PROGRESS.md`.

## Критерии готовности

- Реальный login работает без хранения токенов в `localStorage`.
- Перезагрузка восстанавливает сессию через refresh cookie.
- Courses CRUD использует PostgreSQL API.
- UI/hook интерфейсы не переписаны под HTTP.
- Course mocks удалены только после успешной проверки.
- Остальные модули продолжают работать на mock repositories.
