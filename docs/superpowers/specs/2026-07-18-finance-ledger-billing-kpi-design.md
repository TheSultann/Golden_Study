# Finance Ledger, Billing, Payments and KPI Design

## Цель

Создать единый финансовый контекст Golden Study CRM: неизменяемый ledger, поурочный и месячный billing, платежи учеников, KPI преподавателей, выплаты и безопасные корректировки. Документ заменяет идеи независимо изменяемых `student.balance` и `teacher.salaryBalance`.

## Главный принцип

Финансовая операция после создания не изменяется и не удаляется.

```text
student balance = credits(payments, positive adjustments)
                - debits(charges, negative adjustments)

teacher payable = KPI accruals + positive adjustments
                - payouts - negative adjustments
```

Баланс всегда вычисляется по ledger. Кеш/проекция допускается позже, но не является источником истины.

## Денежные правила

- Все суммы: положительный integer UZS.
- `float` для денег запрещён.
- Промежуточные KPI-расчёты: Prisma `Decimal`.
- Итог: математическое округление до integer UZS.
- Все финансовые изменения выполняются в DB transaction.
- Каждая автоматическая операция имеет уникальный `operationKey`.
- Ошибка исправляется reversal или adjustment, исходная строка сохраняется.
- Любая финансовая операция создаёт AuditLog с actor, entity, before/after и причиной.

## Data model

### LedgerEntry

- `id`;
- `accountType`: `STUDENT|TEACHER|CENTER`;
- `studentId?`, `teacherId?`;
- `direction`: `CREDIT|DEBIT`;
- `category`:
  - `STUDENT_PAYMENT`;
  - `DAILY_LESSON_CHARGE`;
  - `MONTHLY_TUITION_CHARGE`;
  - `KPI_PERCENT_ACCRUAL`;
  - `KPI_PER_STUDENT_ACCRUAL`;
  - `KPI_FIXED_ACCRUAL`;
  - `TEACHER_PAYOUT`;
  - `MANUAL_INCOME`;
  - `MANUAL_EXPENSE`;
  - `ADJUSTMENT`;
  - `REVERSAL`;
- `amountUzs`;
- `operationKey` unique;
- `sourceType`: `ATTENDANCE|MONTHLY_BILLING|PAYMENT|KPI|PAYOUT|MANUAL|REVERSAL`;
- `sourceId?`;
- `reversalOfId?` unique;
- `comment`;
- `createdByUserId`;
- `createdAt`.

Constraints:

- ровно один account owner соответствует `accountType`;
- `amountUzs > 0`;
- reversal указывает на существующую unreversed запись того же account;
- исходная запись не помечается изменяемым balance; факт reversal определяется связью.

### Payment

- `id`, `studentId`, optional `groupId`;
- `amountUzs`;
- `method`: `CASH|CLICK|PAYME|TERMINAL|BANK`;
- `comment`;
- `ledgerEntryId` unique;
- `createdByUserId`, `createdAt`.

Payment — бизнес-метаданные; деньги учитываются только LedgerEntry.

### BillingRun

- `id`;
- `mode`: `DAILY|MONTHLY`;
- `periodKey` (`YYYY-MM` для monthly, дата/attendance ID для daily);
- `status`: `RUNNING|COMPLETED|FAILED`;
- counts и error summary;
- unique `(mode, periodKey)`;
- timestamps.

## Daily billing

Применяется только при `Settings.billingMode=DAILY`.

```text
lessonPrice = mathematicalRound(
  course.pricePerMonthUzs / scheduledLessonsInCalendarMonth
)
```

- `scheduledLessonsInCalendarMonth` считается по weekdays группы и календарю `Asia/Tashkent`.
- Учитываются границы Group `startDate/endDate`.
- Ноль занятий → `422 BUSINESS_ERROR`, деление не выполняется.
- `CAME|ABSENT` создают student debit.
- `EXCUSED` не создаёт debit.
- operation key: `attendance:{attendanceId}:charge:v1`.
- Повторное сохранение Attendance не создаёт дубль.
- Смена chargeable → non-chargeable создаёт reversal.
- Смена non-chargeable → chargeable создаёт debit.
- Смена CAME ↔ ABSENT не меняет сумму и не создаёт новую запись.
- Soft reversal Attendance создаёт reversal начисления.

Attendance save, billing entry и KPI entry выполняются одной DB transaction. Telegram/outbox остаётся отдельным этапом.

## Monthly billing

Применяется только при `Settings.billingMode=MONTHLY`.

- Одно итоговое начисление на `(student, group, YYYY-MM)`.
- operation key: `monthly:{YYYY-MM}:group:{groupId}:student:{studentId}:charge:v1`.
- Полная месячная сумма: `course.pricePerMonthUzs`.
- Пропорция:

```text
charge = mathematicalRound(
  pricePerMonthUzs
  * activeScheduledDays
  / totalScheduledDays
)
```

- `totalScheduledDays`: уроки группы в месяце в границах Group.
- `activeScheduledDays`: только уроки, когда membership активна.
- Join/remove/graduate учитываются через `joinedAt/leftAt`.
- Frozen period требует отдельной истории заморозок; текущее поле Student.status недостаточно.
- Добавляется `StudentStatusPeriod(studentId, status, startedAt, endedAt)`.
- Дни `FROZEN|ARCHIVED` исключаются.
- Ноль scheduled days → запись не создаётся, run фиксирует skipped.
- Reconcile повторно вычисляет ожидаемую сумму:
  - равна ledger → no-op;
  - отличается → adjustment/reversal delta, исходная запись не меняется.

Monthly reconciliation запускается защищённым admin endpoint. BullMQ cron будет подключён позже к тому же service.

## Payments

- Платёж принимает `studentId`, optional `groupId`, `amountUzs`, `method`, `comment`, optional client `idempotencyKey`.
- Backend создаёт Payment и student CREDIT LedgerEntry одной transaction.
- operation key:
  - client key: `payment:{idempotencyKey}`;
  - без client key: backend-generated immutable payment ID.
- Повтор client key возвращает существующий результат без второго зачисления.
- Payment нельзя PATCH/DELETE.
- Ошибка исправляется `POST /payments/:id/reverse`.
- Reversal создаёт student DEBIT, связанный с исходным ledger entry.

## KPI

KPI начисляется только вместе с соответствующим tuition charge.

### PERCENT

```text
kpi = round(chargeAmountUzs * kpiRateBasisPoints / 10000)
```

operation key: `{chargeOperationKey}:kpi:percent:v1`.

### PER_STUDENT

- Месячное начисление за активного student/group.
- Пропорция использует те же `activeScheduledDays/totalScheduledDays`.
- operation key: `kpi:{YYYY-MM}:teacher:{teacherId}:group:{groupId}:student:{studentId}:per-student:v1`.

### FIXED

- Одно месячное начисление на преподавателя.
- За неполный активный месяц преподавателя пропорция не вводится без отдельной employment history; первая версия начисляет configured fixed amount целиком.
- operation key: `kpi:{YYYY-MM}:teacher:{teacherId}:fixed:v1`.

KPI reversal/adjustment следует reversal соответствующего student charge.

## Teacher payouts

- `amountUzs > 0`.
- Доступно только `SUPER_ADMIN|ADMIN`.
- Выплата не может превышать вычисленный teacher payable.
- Создаёт TEACHER DEBIT `TEACHER_PAYOUT` и CENTER DEBIT `MANUAL_EXPENSE`-проекцию в одной transaction либо отчёт строится из одной нормализованной записи. Первая версия использует одну TEACHER DEBIT запись и классифицирует её как расход центра в summary, без дублирования ledger.
- Выплата не редактируется; ошибка исправляется reversal.

## Manual income/expense

- Только `SUPER_ADMIN|ADMIN`.
- `MANUAL_INCOME` → CENTER CREDIT.
- `MANUAL_EXPENSE` → CENTER DEBIT.
- Требуются category label, amountUzs, subject, comment.
- Исправление только reversal.

## API

### Ledger/finance

- `GET /transactions`
- `POST /transactions`
- `POST /transactions/:id/reverse`
- `GET /finance/summary`
- `GET /finance/debtors`

### Payments

- `POST /payments/student`
- `POST /payments/:id/reverse`
- `GET /students/:id/transactions`

### Billing

- `POST /billing/daily/reconcile`
- `POST /billing/monthly/reconcile`
- `GET /billing/runs`

Daily attendance save вызывает тот же BillingService внутри transaction; endpoint нужен для восстановления/проверки пропущенных операций.

### KPI/payout

- `GET /teachers/:id/kpi`
- `POST /teachers/:id/payout`
- `POST /teachers/:id/payouts/:payoutId/reverse`

## Response projections

Текущий frontend `FinanceOverview` не является DB-контрактом. `ApiRepository` позже преобразует нормализованные API DTO:

- summary вычисляется из ledger;
- payments — Payment + Student + Group;
- debtors — student computed balance `< 0`;
- salaries — teacher computed payable;
- transactions — ledger projection.

Так backend не зависит от текущего UI и не хранит дублированные formatted поля.

## RBAC

- Финансы, payments, billing runs, payouts: `SUPER_ADMIN|ADMIN`.
- Teacher не получает финансовые endpoint.
- Student transaction history: только admin на текущем этапе.
- Server-side проверки обязательны на каждом endpoint.

## Идемпотентность и concurrency

- Unique `operationKey` — последний барьер против дублей.
- Критичные операции: `Serializable` transaction с ограниченным retry при Prisma `P2034`.
- Повтор API-запроса с тем же ключом возвращает существующий результат.
- BillingRun lock запрещает параллельный run одного period.
- Attendance unique `(groupId, studentId, date)` сохраняется.

## Ошибки

- `400 VALIDATION_ERROR`;
- `401 UNAUTHORIZED`;
- `403 FORBIDDEN`;
- `404 NOT_FOUND`;
- `409 CONFLICT` — duplicate key/concurrent run/already reversed;
- `422 BUSINESS_ERROR` — insufficient payable, zero lessons, invalid account/state.

## Audit

AuditLog обязателен для:

- payment/reversal;
- tuition charge/reversal/adjustment;
- KPI accrual/reversal/adjustment;
- payout/reversal;
- manual income/expense;
- billing run result;
- смена billing mode.

Пароли, токены, персональные контакты и DB secrets в audit/log не записываются.

## Тесты

### Unit

- число scheduled lessons и zero-lessons;
- daily price rounding;
- monthly proration: full month, mid-month join/remove/freeze, leap year;
- ledger balance signs;
- KPI PERCENT/PER_STUDENT/FIXED;
- operation keys;
- reversal and adjustment decisions.

### Integration

- payment idempotency и reversal;
- Attendance → daily charge + KPI одной transaction;
- status change и reversal без double charge;
- monthly reconcile повторный запуск no-op;
- concurrent billing/payment requests;
- computed debtors/summary;
- payout limit/reversal;
- RBAC и AuditLog.

Перед завершением: Prisma validate/status dev/test, API и workspace test/lint/typecheck/build.

## Вне scope

- frontend binding;
- online payment gateway/webhooks;
- Redis/BullMQ scheduler;
- Telegram notifications;
- Docker;
- cached balances/materialized views.
