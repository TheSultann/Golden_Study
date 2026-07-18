# Core Academic CRUD Backend Design

## Цель

Реализовать production-oriented backend CRUD для курсов, преподавателей, комнат, групп и учеников. Существующий frontend остаётся на mock repositories и не изменяется. OpenAPI заранее фиксирует будущие endpoint.

## Подход

Каждый бизнес-домен — отдельный модуль:

```text
Route → Auth/RBAC → Zod validation → Controller
      → Service → Prisma repository → PostgreSQL
```

Общие helpers допускаются только для pagination, сортировки и ошибок. Универсальный CRUD framework не создаётся.

## Общие правила API

- Base path: `/api/v1`.
- JSON: `camelCase`.
- Даты: ISO 8601.
- Деньги: integer UZS.
- Success:

```json
{
  "success": true,
  "data": {}
}
```

- Paginated success:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

- Default pagination: `page=1`, `limit=20`; maximum `limit=100`.
- Sorting разрешён только по allow-list каждого модуля.
- Все body, params и query валидируются shared Zod schemas.
- Неизвестные поля отклоняются strict schemas.
- Create возвращает `201`, archive/deactivate — `204`.
- Физическое удаление учебной истории не выполняется.

## Контракты frontend

Существующие view schemas (`courseSchema`, `teacherSchema`, `groupSchema`, `studentSchema`) не ломаются. Рядом добавляются API DTO:

- list query;
- create input;
- update input;
- resource response;
- paginated response.

Backend API использует нормализованные поля с ID и integer UZS. UI view models с названиями, counts и форматированием строятся repository mapper при будущем подключении frontend.

Это исключает скрытую зависимость backend от текущего визуального представления.

## Courses

### Endpoint

- `GET /courses`
- `POST /courses`
- `GET /courses/:id`
- `PATCH /courses/:id`
- `DELETE /courses/:id`

### Поля

- `title`;
- `description`;
- `durationMonths`;
- `pricePerMonthUzs`;
- `isActive`;
- computed `groupsCount`, `studentsCount`.

### Правила

- title уникален без учёта регистра;
- `durationMonths`: 1–36;
- `pricePerMonthUzs`: integer, неотрицательный;
- DELETE означает `isActive=false`;
- курс с активными группами нельзя деактивировать: `409 CONFLICT`.

## Teachers

### Endpoint

- `GET /teachers`
- `POST /teachers`
- `GET /teachers/:id`
- `PATCH /teachers/:id`
- `DELETE /teachers/:id`
- `GET /teachers/:id/groups`

### Поля

- `firstName`, `lastName`, `phone`;
- `salaryType`;
- `fixedSalaryUzs`;
- `perStudentRateUzs`;
- `kpiRateBasisPoints`;
- `isActive`;
- user credentials при создании: `login`, `password`.

### Правила

- создание Teacher и User выполняется одной DB transaction;
- password никогда не возвращается;
- salary fields строго соответствуют `salaryType`;
- percent хранится basis points: `8000 = 80%`;
- финансовый баланс не возвращается до реализации ledger/KPI;
- DELETE означает `isActive=false` и `user.isActive=false`;
- преподавателя с активными группами нельзя деактивировать;
- Teacher может читать только собственный профиль и группы.

## Rooms

### Endpoint

- `GET /rooms`
- `POST /rooms`
- `GET /rooms/:id`
- `PATCH /rooms/:id`
- `DELETE /rooms/:id`

### Правила

- name уникален без учёта регистра;
- DELETE означает `isActive=false`;
- комнату активной группы нельзя деактивировать;
- доступ: `SUPER_ADMIN`, `ADMIN`.

## Groups

### Endpoint

- `GET /groups`
- `POST /groups`
- `GET /groups/:id`
- `PATCH /groups/:id`
- `DELETE /groups/:id`
- `GET /groups/:id/students`
- `POST /groups/:id/students`
- `DELETE /groups/:id/students/:studentId`
- `PATCH /groups/:id/students/:studentId/graduate`

### Поля расписания

- `weekdays`;
- `lessonStartMinutes`;
- `lessonDurationMinutes`;
- разрешённые длительности: `60`, `90`, `120`, `150`, `180`;
- default: `90`;
- `startDate`, `endDate`;
- course, teacher, optional room.

### Правила

- backend вычисляет `endDate = startDate + durationMonths`;
- группа требует активные course и teacher;
- inactive room нельзя назначить;
- weekdays уникальны и не пусты;
- урок должен завершаться до конца суток;
- нельзя создавать пересечение уроков одного преподавателя;
- нельзя создавать пересечение уроков одной комнаты;
- конфликт проверяется по общим weekday и интервалам времени;
- собственная группа исключается из conflict query при PATCH;
- DELETE переводит группу в `ARCHIVED`;
- Teacher читает только свои группы и их учеников.

## Students

### Endpoint

- `GET /students`
- `POST /students`
- `GET /students/:id`
- `PATCH /students/:id`
- `DELETE /students/:id`
- `PATCH /students/:id/freeze`
- `PATCH /students/:id/unfreeze`

### Поля

- `studentCode`;
- Ф.И.О.;
- birth date;
- phone/address;
- parent contacts;
- status;
- memberships.

### Правила

- studentCode backend генерирует как `ST101`, `ST102`…;
- генерация выполняется атомарно через singleton `StudentCodeCounter`;
- код никогда не переиспользуется;
- DELETE переводит Student в `ARCHIVED`;
- freeze переводит в `FROZEN`, unfreeze — в `ACTIVE`;
- frozen/archived student нельзя добавить в группу;
- один student не может иметь две активные membership одной группы;
- удаление из группы закрывает membership: `REMOVED`, `leftAt=now`;
- graduation закрывает membership: `GRADUATE`, `leftAt=now`;
- история membership сохраняется;
- Teacher видит только учеников собственных групп;
- баланс не хранится и не возвращается до finance ledger.

## Pagination и filtering

### Общие query

- `page`, `limit`;
- `search`;
- `sortBy`, `sortOrder=asc|desc`.

### Filters

- courses: `isActive`;
- teachers: `isActive`, `salaryType`;
- rooms: `isActive`;
- groups: `status`, `courseId`, `teacherId`, `roomId`;
- students: `status`, `groupId`.

Teacher-scope всегда добавляется backend, независимо от query пользователя.

## RBAC

- `SUPER_ADMIN`: полный CRUD.
- `ADMIN`: полный рабочий CRUD, кроме создания/изменения `SUPER_ADMIN`.
- `TEACHER`: read-only собственный профиль, группы и ученики.
- Teacher ownership проверяется в Prisma query и service policy.
- Скрытие frontend-кнопок не считается защитой.

## Database changes

- добавить `Group.lessonDurationMinutes Int @default(90)`;
- добавить `StudentCodeCounter` singleton;
- добавить case-insensitive unique indexes через migration SQL:
  - `LOWER(Course.title)`;
  - `LOWER(Room.name)`;
- добавить partial unique index для одной активной membership `(groupId, studentId)`;
- database constraints для duration, lesson time, money и salary rates.

Все изменения — отдельная Prisma migration.

## Транзакции

Обязательные transaction boundaries:

- Teacher + User create/update/deactivate;
- Student code increment + Student create;
- membership add/remove/graduate;
- group create/update вместе с conflict validation, с transaction isolation `Serializable`.

При serialization conflict backend возвращает безопасный `409`, клиент может повторить запрос.

## Ошибки

- invalid DTO/query/param → `400 VALIDATION_ERROR`;
- unauthenticated → `401 UNAUTHORIZED`;
- wrong role/ownership → `403 FORBIDDEN`;
- missing resource → `404 NOT_FOUND`;
- duplicate/conflict/active dependency → `409 CONFLICT`;
- invalid state transition → `422 BUSINESS_ERROR`;
- Prisma и stack details клиенту не возвращаются.

## OpenAPI

OpenAPI 3.1 документирует:

- все endpoint и query;
- request/response schemas;
- pagination meta;
- Bearer security;
- role restrictions в descriptions;
- error responses;
- архивирование вместо физического удаления.

Swagger UI: `/api/docs`.
JSON: `/api/openapi.json`.

## Тестирование

### Unit

- pagination parser;
- salary-field validation;
- end-date calculation;
- schedule overlap;
- student code generation;
- membership state transitions;
- teacher ownership.

### Integration

- CRUD каждого ресурса;
- pagination/search/filter/sort;
- unique title/name/login;
- archive/deactivate restrictions;
- Teacher cannot access foreign data;
- schedule teacher/room conflict;
- student code concurrency;
- membership duplicate protection/history;
- OpenAPI contains every endpoint.

Tests используют `golden_study_test`, очищают только созданные fixtures и не затрагивают dev DB.

## Критерии готовности

- migration применена к dev/test DB;
- CRUD работает через реальные PostgreSQL queries;
- RBAC/ownership подтверждены integration-тестами;
- OpenAPI соответствует routes;
- API и workspace test/lint/typecheck/build проходят;
- frontend и Docker не изменены;
- `docs/PROGRESS.md` обновлён.
