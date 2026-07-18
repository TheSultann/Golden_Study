# Leads and Attendance Backend Design

## Цель

Реализовать PostgreSQL API для воронки лидов и посещаемости без подключения frontend. Контракты должны соответствовать текущим frontend repository и правилам `Golden_Study-CRM-TZ.md`/`Eduxa_Backend_TZ.md`.

## Общие правила

- Base path: `/api/v1`.
- Все входные данные проверяются shared Zod-схемами.
- Списки имеют серверную пагинацию, поиск, фильтры и allow-list сортировки.
- Leads доступны только `SUPER_ADMIN|ADMIN`.
- Attendance доступна `SUPER_ADMIN|ADMIN` и преподавателю только для собственных групп.
- Даты API: `YYYY-MM-DD`; время БД: UTC; timezone бизнеса: `Asia/Tashkent`.
- Физическое удаление учебной/финансовой истории запрещено.

## Leads

### Модель

- `id`, `fullName`, `phone`;
- optional `interestedCourseId`, `teacherId`;
- `status`: `NEW|CONTACTED|CALLBACK|TRIAL|CONVERTED|ARCHIVED`;
- `comment`;
- optional `convertedStudentId`;
- `createdAt`, `updatedAt`.

### Endpoint

- `GET /leads`
- `POST /leads`
- `GET /leads/:id`
- `PATCH /leads/:id`
- `PATCH /leads/:id/status`
- `POST /leads/:id/convert`
- `DELETE /leads/:id`

### Правила

- Телефон хранится в нормализованном формате `+998XXXXXXXXX`.
- Course/teacher при указании должны существовать и быть активными.
- DELETE переводит lead в `ARCHIVED`.
- Конвертация выполняется одной `Serializable` transaction:
  1. Проверить, что lead не `CONVERTED|ARCHIVED`.
  2. Атомарно выделить новый `ST101+`.
  3. Создать Student из данных lead.
  4. При `groupId` проверить активную группу и создать membership.
  5. Установить `CONVERTED` и `convertedStudentId`.
- Повторная конвертация возвращает `409` и не создаёт второго Student.

## Attendance

### Модель

- `id`, `groupId`, `studentId`, `date`;
- `status`: `CAME|EXCUSED|ABSENT`;
- optional `rating` 1–5;
- `homeworkDone`, `comment`;
- `lockedByAdmin`;
- `isReversed`, optional `reversedAt`, `reversedByUserId`;
- `createdByUserId`, `createdAt`, `updatedAt`;
- unique `(groupId, studentId, date)`.

### Endpoint

- `GET /attendance`
- `GET /attendance/group/:groupId/date/:date`
- `POST /attendance` — bulk upsert session
- `PATCH /attendance/:id` — admin correction
- `DELETE /attendance/:id` — admin reversal marker, без физического удаления
- `GET /students/:id/attendance`

### Bulk save

Request:

```json
{
  "groupId": "uuid",
  "date": "2026-07-08",
  "items": [
    {
      "studentId": "uuid",
      "status": "CAME",
      "rating": 5,
      "homeworkDone": true,
      "comment": "Good"
    }
  ]
}
```

### Правила

- Все items сохраняются одной transaction.
- Каждый student должен иметь membership указанной группы на эту дату.
- Повторное сохранение обновляет существующую запись, не создаёт дубль.
- Сохранение админом устанавливает `lockedByAdmin=true`.
- Teacher не может изменить запись с `lockedByAdmin=true`.
- Teacher может работать только со своей группой.
- Bulk request не допускает повторяющиеся `studentId`.
- `rating` обязателен для `CAME`; для `EXCUSED|ABSENT` допускается `null`.
- DELETE не удаляет строку: создаётся audit/reversal state, чтобы будущий Billing мог выполнить обратную операцию.

## Billing/KPI/Telegram boundary

В этом этапе финансовые записи, KPI и BullMQ jobs не создаются. Attendance service формирует стабильный уникальный operation key:

```text
attendance:{attendanceId}:charge:v1
```

Следующий Billing этап использует его для идемпотентного списания:

- `CAME|ABSENT` — списание;
- `EXCUSED` — без списания;
- изменение влияющего статуса — отдельная reversal/correction операция;
- финансовые строки не обновляются задним числом.

Telegram job будет создаваться после успешной DB transaction через outbox/BullMQ, не внутри HTTP-вызова.

## Ошибки

- `400 VALIDATION_ERROR` — DTO/query/date;
- `401 UNAUTHORIZED`;
- `403 FORBIDDEN` — роль, ownership или admin lock;
- `404 NOT_FOUND`;
- `409 CONFLICT` — повторная конвертация, duplicate/serialization conflict;
- `422 BUSINESS_ERROR` — неактивная зависимость или неверный переход.

## Тесты

- Unit: lead transitions, attendance validation, charge decision и operation key.
- Integration: Leads CRUD/filter/convert/idempotency; Student+membership transaction.
- Integration: Attendance bulk upsert, unique constraint, admin lock, teacher ownership, membership-on-date.
- OpenAPI assertions для каждого endpoint.
- Финально: Prisma validate/status, workspace test/lint/typecheck/build.

## Вне scope

- frontend ApiRepository binding;
- Billing ledger и payments;
- KPI ledger/payouts;
- Redis/BullMQ и Telegram;
- Docker.
