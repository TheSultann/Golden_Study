# API Contracts

## Общие правила

- Base path: `/api/v1`.
- JSON использует `camelCase`.
- Даты: ISO 8601. UI преобразует их в `DD.MM.YYYY`.
- Деньги: целое число UZS.
- Все входные и выходные данные валидируются общей Zod-схемой из `packages/contracts`.

## Ответы

Успешный одиночный ресурс:

```json
{ "data": {} }
```

Список:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 0, "pageCount": 0 }
}
```

Ошибка:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {},
    "requestId": "uuid"
  }
}
```

## Соглашения

- `GET /resources` — список с пагинацией, поиском, фильтрами и сортировкой.
- `GET /resources/:id` — один ресурс.
- `POST /resources` — создание, статус `201`.
- `PATCH /resources/:id` — частичное изменение.
- `DELETE /resources/:id` — только когда бизнес-правила допускают удаление, статус `204`.
- Финансовые записи не удаляются; используются reversal/correction endpoints.
- Для идемпотентных финансовых команд обязателен заголовок `Idempotency-Key`.

Конкретные DTO и endpoint добавляются перед разработкой каждого модуля. Mock repositories обязаны соответствовать этим контрактам.
