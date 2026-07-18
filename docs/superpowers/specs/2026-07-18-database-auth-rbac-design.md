# Database, Auth and RBAC Design

## Цель

Создать первую рабочую backend-вертикаль Golden Study CRM: PostgreSQL schema, миграцию, безопасную авторизацию, RBAC, seed и OpenAPI. Frontend пока не подключается. Docker не используется.

## Границы этапа

В этап входят:

- создание локальных БД `golden_study` и `golden_study_test`;
- Prisma-модели базового учебного контура;
- первая Prisma migration;
- dev seed;
- Auth endpoints;
- access JWT и refresh token rotation;
- refresh token только в `httpOnly` cookie;
- server-side RBAC;
- базовый teacher ownership contract;
- rate limiting Auth endpoints;
- shared Zod-контракты Auth;
- OpenAPI для всех созданных endpoint;
- unit- и integration-тесты на отдельной test DB.

Не входят:

- подключение frontend;
- Docker;
- бизнес-CRUD курсов, групп и студентов;
- посещаемость, финансы, KPI;
- Redis/BullMQ и Telegram;
- production deployment.

## Выбранный подход

Используется модульный монолит:

```text
Route → validation/auth/rate-limit middleware → Controller
      → Service → Repository interface → PrismaRepository → PostgreSQL
```

Repository interface нужен в Auth для unit-тестов без БД. Integration-тесты используют настоящий PostgreSQL и Prisma.

Не создаются универсальные base-controller/base-repository. Каждый файл имеет одну ответственность.

## Модель данных

### User

- `id`: UUID;
- `login`: unique, нормализованный lowercase;
- `passwordHash`;
- `role`: `SUPER_ADMIN | ADMIN | TEACHER`;
- `isActive`;
- `teacherId`: nullable unique;
- timestamps.

### RefreshToken

- `id`: UUID;
- `tokenHash`: SHA-256 hash, unique;
- `userId`;
- `expiresAt`;
- `revokedAt`;
- `replacedByTokenId`;
- `createdAt`;
- relation на `User`;
- indexes по `userId`, `expiresAt`.

В БД никогда не хранится raw refresh token.

### Teacher

- персональные данные;
- `salaryType`: `FIXED | PER_STUDENT | PERCENT`;
- ставки хранятся целыми UZS или basis points, без `float`;
- `isActive`;
- optional one-to-one relation на `User`;
- timestamps.

Финансовый баланс преподавателя не хранится. Он будет вычисляться из ledger на финансовом этапе.

### Course

- title, description;
- `durationMonths`;
- `pricePerMonthUzs`: integer;
- `isActive`;
- timestamps.

### Room

- name;
- `isActive`;
- timestamps.

### Group

- name;
- course, teacher, optional room;
- weekdays enum array;
- `lessonStartMinutes`: минуты от начала суток;
- start/end date;
- status;
- timestamps.

Время хранится числом минут, чтобы избежать строковых значений вроде `18:5`.

### Student

- `studentCode`: unique;
- Ф.И.О., контакты и дата рождения;
- status;
- timestamps.

Баланс не хранится: позже он будет вычисляться по immutable ledger.

### GroupStudent

- group/student;
- `joinedAt`, optional `leftAt`;
- status;
- unique `(groupId, studentId, joinedAt)`.

История вступлений сохраняется; повторное вступление после перевода или выпуска допустимо.

### Settings

Singleton-настройки одного учебного центра: название, logo URL, billing mode, timezone.

### AuditLog

Append-only запись: actor, action, entity, entityId, before/after JSON, IP, user-agent, createdAt.

## Auth API

Все endpoint используют prefix `/api/v1`.

### `POST /auth/login`

Request:

```json
{
  "login": "admin",
  "password": "strong-password"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "login": "admin",
      "role": "ADMIN",
      "teacherId": null
    },
    "accessToken": "jwt",
    "expiresInSeconds": 900
  }
}
```

Refresh token устанавливается cookie и не возвращается в JSON.

### `POST /auth/refresh`

Читает refresh cookie, проверяет hash/session, отзывает старый token, создаёт новый refresh token и access token. Rotation выполняется в транзакции.

### `POST /auth/logout`

Требует refresh cookie, отзывает текущую session и очищает cookie. Повторный logout остаётся безопасным.

### `GET /auth/me`

Требует access JWT. Возвращает текущего активного пользователя.

### Вспомогательные endpoint

`GET /api/v1/rbac/admin-check` добавляется только как integration-test probe и не входит в production API. Вместо test-only route RBAC проверяется через `GET /auth/sessions`, доступный только `SUPER_ADMIN`.

### `GET /auth/sessions`

Возвращает активные refresh sessions текущего пользователя. Endpoint доступен только `SUPER_ADMIN` на этом этапе и документируется в OpenAPI.

## Token security

- access JWT TTL: 15 минут;
- refresh JWT TTL: 30 дней;
- разные secrets;
- refresh payload содержит `sub`, `jti`, `type=refresh`;
- access payload содержит `sub`, `role`, `teacherId`, `type=access`;
- refresh token хранится в cookie `golden_refresh`;
- cookie: `httpOnly`, `sameSite=lax`, `secure` только production, path `/api/v1/auth`;
- raw tokens, cookies и passwords не логируются;
- password hash: bcrypt, cost 12;
- login error одинаковый для неизвестного login и неверного password;
- inactive user не может login/refresh/me;
- logout и rotation отзывают session;
- Auth rate limit: 10 попыток за 15 минут на IP.

## RBAC и ownership

- `authenticate` проверяет access JWT и загружает актуального пользователя из БД;
- `requireRoles(...roles)` проверяет роль;
- запрещено доверять роли только из JWT после блокировки пользователя;
- `TEACHER` ownership реализуется отдельным policy/helper, принимающим текущий `teacherId`;
- реальные ownership-запросы появятся вместе с CRUD групп и студентов;
- отсутствие access token возвращает `401`, нехватка роли — `403`.

## Контракты и OpenAPI

Auth request/response Zod-схемы размещаются в `packages/contracts/src/auth.ts`.

OpenAPI описывает:

- `/api/v1/health`;
- `/api/v1/auth/login`;
- `/api/v1/auth/refresh`;
- `/api/v1/auth/logout`;
- `/api/v1/auth/me`;
- `/api/v1/auth/sessions`;
- cookie auth и Bearer auth;
- success/error envelopes;
- `400`, `401`, `403`, `429`, `500`.

OpenAPI генерируется из Zod-схем там, где это возможно. Ручное дублирование полей минимизируется.

Swagger UI остаётся на `/api/docs`, JSON schema публикуется на `/api/openapi.json`.

## Seed

Seed создаёт:

- singleton Settings;
- super-admin;
- admin;
- teacher user + Teacher;
- 3 courses;
- 4 rooms;
- 2 groups;
- 10 students и membership.

Seed идемпотентен через stable unique keys/upsert. Пароли берутся из `SEED_*_PASSWORD` env variables и хэшируются. Пароли не логируются.

## Migration strategy

- база изменяется только через Prisma migration;
- первая migration создаётся через `prisma migrate dev`;
- migration SQL проверяется до применения;
- test DB мигрируется отдельно;
- schema использует indexes для login, refresh sessions, teacher/group/student relations;
- удаление базовых сущностей позже будет soft-delete/archive, не каскадное физическое удаление бизнес-истории.

## Ошибки

- Zod errors → `400 VALIDATION_ERROR`;
- неверные credentials/token → `401 UNAUTHORIZED`;
- недостаточная роль → `403 FORBIDDEN`;
- duplicate login → `409 CONFLICT`;
- бизнес-ограничения → `422 BUSINESS_ERROR`;
- Prisma details и stack trace не возвращаются клиенту.

## Тестирование

### Unit

- password hashing/verification;
- JWT generation/verification/type validation;
- AuthService login;
- одинаковая ошибка для неверного login/password;
- refresh rotation;
- role middleware;
- ownership helper.

### Integration

- migration применена к `golden_study_test`;
- login устанавливает secure-shaped `httpOnly` cookie;
- refresh меняет refresh token и отзывает предыдущий;
- повторное использование отозванного refresh token запрещено;
- logout отзывает token и очищает cookie;
- `/me` работает с access token;
- inactive user получает `401`;
- `ADMIN` получает `403` на `/auth/sessions`;
- `SUPER_ADMIN` получает список sessions;
- rate limit возвращает `429`;
- OpenAPI содержит все Auth paths.

Каждый production behavior реализуется через TDD: failing test → минимальная реализация → green → refactor.

## Локальная инфраструктура

- используется установленный PostgreSQL 18 на `localhost:5000`;
- Docker не добавляется;
- `.env` остаётся локальным и исключён из Git;
- dev и test DB разделены;
- Redis не требуется на этом этапе.

## Критерии готовности

- обе БД созданы и миграция применена;
- seed выполняется повторно без дублей;
- Auth/RBAC endpoints работают через PostgreSQL;
- refresh token отсутствует в JSON и БД в открытом виде;
- OpenAPI и Swagger отражают реальные endpoint;
- API и workspace `test`, `lint`, `typecheck`, `build` проходят;
- `docs/PROGRESS.md` обновлён;
- frontend не изменён и не подключён.
