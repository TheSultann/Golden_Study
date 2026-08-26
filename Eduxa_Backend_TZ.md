# Backend ТЗ: Eduxa CRM

> Версия: 1.0  
> Backend stack: Node.js + Express + TypeScript + PostgreSQL + Prisma  
> Проект: CRM-платформа для учебных центров с Telegram-интеграцией  
> Статус: техническое задание для самостоятельной backend-разработки  
> Docker: не используется на первом этапе, но архитектура должна быть готова к последующей контейнеризации

---

## 0. Цель документа

Этот документ описывает backend-часть проекта **Eduxa CRM** на уровне, достаточном для senior-разработки: архитектура, структура проекта, база данных, API, авторизация, RBAC, финансы, KPI, Telegram-интеграция, отчёты, валидация, безопасность, обработка ошибок и порядок разработки.

Основной фронтенд уже реализован на mock/fake data. Задача backend — заменить mock-данные настоящим API, базой данных и бизнес-логикой.

---

## 1. Backend stack

### 1.1 Основной стек

| Назначение | Технология |
|---|---|
| Runtime | Node.js LTS |
| Framework | Express.js |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT access token + refresh token |
| Password hashing | bcrypt |
| Validation | Zod |
| API docs | Swagger / OpenAPI |
| File upload | multer |
| Telegram bot | Telegraf.js |
| Logging | pino или winston |
| Testing | Jest + Supertest |
| Code quality | ESLint + Prettier |

### 1.2 Что такое Prisma в проекте

Prisma — это ORM, который будет отвечать за:

- описание структуры БД в `schema.prisma`;
- миграции PostgreSQL;
- типобезопасные запросы к базе;
- связи между таблицами;
- seed demo-данных;
- удобную работу с TypeScript.

Backend не должен писать SQL вручную для стандартного CRUD. SQL допускается только для сложных аналитических отчётов, если Prisma-запросы становятся слишком тяжёлыми.

---

## 2. Главные принципы backend-архитектуры

1. **Frontend не должен решать бизнес-логику.**  
   Все расчёты балансов, KPI, ролей, доступов, Telegram-событий выполняются на backend.

2. **UI-защита не считается безопасностью.**  
   Даже если кнопка скрыта на frontend, backend обязан проверять роль пользователя на каждом endpoint.

3. **Проект работает как CRM для одного учебного центра.**  
   Backend ведёт все данные в рамках одной системы. Разделения на несколько центров в архитектуре нет.

4. **Финансовые операции должны быть идемпотентными.**  
   Нельзя допустить двойного списания за одну посещаемость или двойного начисления KPI.

5. **Telegram не должен блокировать основной запрос.**  
   На первом этапе можно реализовать простую асинхронную отправку, но архитектурно нужно отделить `NotificationService`.

6. **Все входные данные валидируются через Zod.**  
   Нельзя доверять данным с frontend.

7. **Единый формат ответа API.**  
   Frontend должен получать предсказуемую структуру response/error.

8. **Проект должен быть готов к Docker позже.**  
   Сейчас Docker не подключается, но `.env`, структура, миграции и запуск должны быть production-friendly.

---

## 3. Архитектура backend

### 3.1 Общая схема

```txt
Frontend Next.js
    |
    | REST API + JWT
    v
Express API
    |
    | Prisma Client
    v
PostgreSQL
    |
    | Events / NotificationService
    v
Telegram Bot / Telegram API
```

### 3.2 Основные backend-слои

```txt
Route -> Middleware -> Controller -> Service -> Repository/Prisma -> Database
```

| Слой | Ответственность |
|---|---|
| routes | объявление endpoint'ов |
| middlewares | auth, roles, validation, errors |
| controllers | принимает request, вызывает service, возвращает response |
| services | бизнес-логика |
| repositories | запросы к БД, если нужно отделить от service |
| prisma | работа с PostgreSQL |
| utils | общие функции, ошибки, форматирование |

---

## 4. Структура проекта

```txt
eduxa-backend/
  prisma/
    schema.prisma
    seed.ts
    migrations/

  src/
    app.ts
    server.ts

    config/
      env.ts
      prisma.ts
      swagger.ts
      logger.ts

    common/
      constants/
        roles.ts
        statuses.ts
      errors/
        ApiError.ts
      helpers/
        pagination.ts
        date.ts
        money.ts
      types/
        express.d.ts

    middlewares/
      auth.middleware.ts
      role.middleware.ts
      validate.middleware.ts
      error.middleware.ts
      notFound.middleware.ts
      rateLimit.middleware.ts

    modules/
      auth/
        auth.routes.ts
        auth.controller.ts
        auth.service.ts
        auth.validation.ts
        auth.types.ts

      users/
        users.routes.ts
        users.controller.ts
        users.service.ts
        users.validation.ts

      teachers/
      courses/
      rooms/
      groups/
      students/
      leads/
      attendance/
      exams/
      finance/
      reports/
      announcements/
      telegram/
      settings/
      dashboard/

    services/
      billing.service.ts
      kpi.service.ts
      notification.service.ts
      telegram.service.ts
      audit.service.ts

    jobs/
      debt-reminder.job.ts
      monthly-billing.job.ts

    docs/
      openapi.yaml

  tests/
    unit/
    integration/

  .env.example
  package.json
  tsconfig.json
  README.md
```

---

## 5. Environment variables

Файл `.env.example`:

```env
NODE_ENV=development
PORT=4000

DATABASE_URL="postgresql://postgres:password@localhost:5432/eduxa_crm?schema=public"

JWT_ACCESS_SECRET="change_me_access_secret"
JWT_REFRESH_SECRET="change_me_refresh_secret"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="30d"

BCRYPT_SALT_ROUNDS=12

FRONTEND_URL="http://localhost:3000"

TELEGRAM_BOT_TOKEN=""
TELEGRAM_WEBHOOK_SECRET=""

UPLOAD_DIR="uploads"
MAX_FILE_SIZE_MB=5
```

Запрещено хранить реальные секреты в git.

---

## 6. Единый формат API

### 6.1 Success response

```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

`meta` используется только для списков.

### 6.2 Error response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": []
  }
}
```

### 6.3 Основные error codes

| Code | HTTP | Meaning |
|---|---:|---|
| VALIDATION_ERROR | 400 | ошибка валидации |
| UNAUTHORIZED | 401 | пользователь не авторизован |
| FORBIDDEN | 403 | нет доступа |
| NOT_FOUND | 404 | запись не найдена |
| CONFLICT | 409 | конфликт данных |
| BUSINESS_ERROR | 422 | нарушение бизнес-правила |
| INTERNAL_ERROR | 500 | внутренняя ошибка |

---

## 7. Авторизация и роли

### 7.1 Роли

```ts
enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER'
}
```

### 7.2 JWT payload

```json
{
  "userId": "uuid",
  "role": "ADMIN",
  "teacherId": "uuid|null"
}
```

### 7.3 Access rules

| Роль | Доступ |
|---|---|
| SUPER_ADMIN | все модули, управление пользователями и системными настройками |
| ADMIN | все рабочие CRM-модули, кроме критичных системных действий |
| TEACHER | только свои группы, студенты, расписание, посещаемость, экзамены |

### 7.4 Auth endpoints

#### POST `/api/auth/login`

Request:

```json
{
  "login": "admin",
  "password": "password"
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
    "refreshToken": "jwt"
  }
}
```

Logic:

1. Найти пользователя по `login`.
2. Проверить пароль через bcrypt.
3. Проверить `isActive`.
4. Вернуть access и refresh token.
5. Сохранить refresh token hash в БД.

#### POST `/api/auth/refresh`

Request:

```json
{
  "refreshToken": "jwt"
}
```

Logic:

1. Проверить refresh token.
2. Найти session/token в БД.
3. Выдать новый access token.

#### POST `/api/auth/logout`

Удаляет/инвалидирует refresh token.

#### GET `/api/auth/me`

Возвращает текущего пользователя.

---

## 8. Single-center логика

Проект работает для одного учебного центра.

Правила:

- все данные принадлежат одной CRM-системе;
- нет выбора отдельного центра внутри приложения;
- разграничение доступа строится только через роли и ownership преподавателя;
- преподаватель видит только свои группы, студентов, расписание, посещаемость и экзамены.

---

## 9. Prisma database schema: основные модели

Ниже — концептуальная схема. В реальном `schema.prisma` поля можно расширять.

### 9.2 User

```prisma
model User {
  id           String   @id @default(uuid())
  login        String   @unique
  passwordHash String
  role         Role
  isActive     Boolean  @default(true)
  teacherId    String?  @unique
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  teacher Teacher?
  refreshTokens RefreshToken[]
}

enum Role {
  SUPER_ADMIN
  ADMIN
  TEACHER
}
```

### 9.3 RefreshToken

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  tokenHash String
  userId    String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}
```

### 9.4 Teacher

```prisma
model Teacher {
  id            String      @id @default(uuid())
  userId        String?     @unique
  firstName     String
  lastName      String
  phone         String
  salaryType    SalaryType
  kpiRate       Decimal?    @db.Decimal(5, 2)
  fixedSalary   Decimal?    @db.Decimal(14, 2)
  salaryBalance Decimal     @default(0) @db.Decimal(14, 2)
  isActive      Boolean     @default(true)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  user   User?   @relation(fields: [userId], references: [id])
  groups Group[]
}

enum SalaryType {
  FIXED
  PER_STUDENT
  PERCENT
}
```

### 9.5 Course

```prisma
model Course {
  id            String   @id @default(uuid())
  title         String
  description   String?
  durationMonths Int
  pricePerMonth Decimal  @db.Decimal(14, 2)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  groups Group[]
}
```

### 9.6 Room

```prisma
model Room {
  id        String   @id @default(uuid())
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  groups Group[]
}
```

### 9.7 Group

```prisma
model Group {
  id        String   @id @default(uuid())
  name      String
  courseId  String
  teacherId String
  roomId    String?
  weekdays  String[]
  time      String
  startDate DateTime
  endDate   DateTime?
  status    GroupStatus @default(ACTIVE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  course  Course  @relation(fields: [courseId], references: [id])
  teacher Teacher @relation(fields: [teacherId], references: [id])
  room    Room?   @relation(fields: [roomId], references: [id])

  students   GroupStudent[]
  attendance Attendance[]
  exams      Exam[]
}

enum GroupStatus {
  ACTIVE
  ARCHIVED
  COMPLETED
}
```

### 9.8 Student

```prisma
model Student {
  id          String        @id @default(uuid())
  studentCode String        @unique
  firstName   String
  lastName    String
  birthDate   DateTime?
  phone       String?
  address     String?
  parentName  String?
  parentPhone String?
  status      StudentStatus @default(ACTIVE)
  balance     Decimal       @default(0) @db.Decimal(14, 2)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  groups GroupStudent[]
  attendance Attendance[]
  transactions Transaction[]
  telegramLinks TelegramLink[]
}

enum StudentStatus {
  ACTIVE
  FROZEN
  GRADUATE
  ARCHIVED
}
```

### 9.9 GroupStudent

```prisma
model GroupStudent {
  id        String @id @default(uuid())
  groupId   String
  studentId String
  joinedAt  DateTime @default(now())
  status    GroupStudentStatus @default(ACTIVE)

  group   Group   @relation(fields: [groupId], references: [id])
  student Student @relation(fields: [studentId], references: [id])

  @@unique([groupId, studentId])
}

enum GroupStudentStatus {
  ACTIVE
  GRADUATE
  REMOVED
}
```

### 9.10 Attendance

```prisma
model Attendance {
  id             String           @id @default(uuid())
  groupId        String
  studentId      String
  date           DateTime
  status         AttendanceStatus
  rating         Int?
  homeworkDone   Boolean?
  comment        String?
  lockedByAdmin  Boolean          @default(false)
  createdByUserId String
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  group   Group   @relation(fields: [groupId], references: [id])
  student Student @relation(fields: [studentId], references: [id])

  @@unique([groupId, studentId, date])
}

enum AttendanceStatus {
  CAME
  EXCUSED
  ABSENT
}
```

### 9.11 Transaction

```prisma
model Transaction {
  id          String          @id @default(uuid())
  studentId   String?
  teacherId   String?
  type        TransactionType
  category    TransactionCategory
  amount      Decimal         @db.Decimal(14, 2)
  comment     String?
  source      TransactionSource
  sourceId    String?
  createdByUserId String?
  createdAt   DateTime        @default(now())
  student Student? @relation(fields: [studentId], references: [id])

  @@index([createdAt])
  @@index([studentId])
  @@index([teacherId])
}

enum TransactionType {
  INCOME
  EXPENSE
}

enum TransactionCategory {
  STUDENT_PAYMENT
  STUDENT_LESSON_CHARGE
  TEACHER_SALARY
  OTHER_INCOME
  OTHER_EXPENSE
}

enum TransactionSource {
  MANUAL
  ATTENDANCE
  PAYMENT
  SALARY_PAYOUT
  SYSTEM
}
```

### 9.12 Lead

```prisma
model Lead {
  id                 String     @id @default(uuid())
  fullName            String
  phone               String
  interestedCourseId  String?
  teacherId           String?
  status              LeadStatus @default(NEW)
  comment             String?
  convertedStudentId  String?
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt
}

enum LeadStatus {
  NEW
  CONTACTED
  CALLBACK
  TRIAL
  CONVERTED
  LOST
}
```

### 9.13 Exam and ExamResult

```prisma
model Exam {
  id        String   @id @default(uuid())
  groupId   String
  name      String
  date      DateTime
  maxScore  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  group   Group @relation(fields: [groupId], references: [id])
  results ExamResult[]
}

model ExamResult {
  id        String @id @default(uuid())
  examId    String
  studentId String
  score     Int
  comment   String?
  rank      Int?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  exam Exam @relation(fields: [examId], references: [id])

  @@unique([examId, studentId])
}
```

### 9.14 TelegramLink

```prisma
model TelegramLink {
  id             String             @id @default(uuid())
  telegramChatId String
  studentId      String
  status         TelegramLinkStatus @default(PENDING)
  requestedAt    DateTime           @default(now())
  approvedAt     DateTime?
  rejectedAt     DateTime?

  student Student @relation(fields: [studentId], references: [id])

  @@unique([telegramChatId, studentId])
}

enum TelegramLinkStatus {
  PENDING
  ACTIVE
  REJECTED
}
```

### 9.15 Settings

```prisma
model Settings {
  id          String      @id @default(uuid())      @unique
  centerName  String
  logoUrl     String?
  billingMode BillingMode @default(DAILY)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

enum BillingMode {
  DAILY
  MONTHLY
}
```

---

## 10. Backend modules

## 10.1 Auth module

Responsibilities:

- login;
- refresh token;
- logout;
- current user;
- password hashing;
- token generation;
- token revocation.

Endpoints:

| Method | URL | Access |
|---|---|---|
| POST | `/api/auth/login` | public |
| POST | `/api/auth/refresh` | public |
| POST | `/api/auth/logout` | auth |
| GET | `/api/auth/me` | auth |

---

## 10.2 Users / Staff module

Responsibilities:

- создание админов;
- создание teacher user при создании преподавателя;
- смена роли;
- блокировка пользователя;
- сброс пароля.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/users` | SUPER_ADMIN, ADMIN |
| POST | `/api/users` | SUPER_ADMIN |
| PATCH | `/api/users/:id` | SUPER_ADMIN |
| PATCH | `/api/users/:id/block` | SUPER_ADMIN |
| PATCH | `/api/users/:id/reset-password` | SUPER_ADMIN |

Admin не может создавать SUPER_ADMIN.

---

## 10.3 Teachers module

Responsibilities:

- CRUD преподавателей;
- создание login/password для teacher panel;
- просмотр групп преподавателя;
- KPI balance;
- salary payout.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/teachers` | SUPER_ADMIN, ADMIN |
| POST | `/api/teachers` | SUPER_ADMIN, ADMIN |
| GET | `/api/teachers/:id` | SUPER_ADMIN, ADMIN |
| PATCH | `/api/teachers/:id` | SUPER_ADMIN, ADMIN |
| DELETE | `/api/teachers/:id` | SUPER_ADMIN, ADMIN |
| GET | `/api/teachers/:id/groups` | SUPER_ADMIN, ADMIN, own TEACHER |
| POST | `/api/teachers/:id/payout` | SUPER_ADMIN, ADMIN |

Create teacher request:

```json
{
  "firstName": "Ali",
  "lastName": "Valiyev",
  "phone": "+998901234567",
  "salaryType": "PERCENT",
  "kpiRate": 80,
  "login": "teacher_ali",
  "password": "12345678"
}
```

---

## 10.4 Courses module

Responsibilities:

- CRUD курсов;
- цена за месяц;
- длительность;
- активность курса.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/courses` | auth |
| POST | `/api/courses` | SUPER_ADMIN, ADMIN |
| GET | `/api/courses/:id` | auth |
| PATCH | `/api/courses/:id` | SUPER_ADMIN, ADMIN |
| DELETE | `/api/courses/:id` | SUPER_ADMIN, ADMIN |

Teacher может читать только данные, связанные со своими группами, если это нужно для UI.

---

## 10.5 Rooms module

Responsibilities:

- аудитории учебного центра;
- привязка комнат к группам.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/rooms` | SUPER_ADMIN, ADMIN |
| POST | `/api/rooms` | SUPER_ADMIN, ADMIN |
| PATCH | `/api/rooms/:id` | SUPER_ADMIN, ADMIN |
| DELETE | `/api/rooms/:id` | SUPER_ADMIN, ADMIN |

---

## 10.6 Groups module

Responsibilities:

- создание групп;
- привязка курса, преподавателя, комнаты;
- расписание группы;
- добавление/удаление студентов;
- перевод студента в выпускники.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/groups` | SUPER_ADMIN, ADMIN, TEACHER own data |
| POST | `/api/groups` | SUPER_ADMIN, ADMIN |
| GET | `/api/groups/:id` | SUPER_ADMIN, ADMIN, own TEACHER |
| PATCH | `/api/groups/:id` | SUPER_ADMIN, ADMIN |
| DELETE | `/api/groups/:id` | SUPER_ADMIN, ADMIN |
| GET | `/api/groups/:id/students` | SUPER_ADMIN, ADMIN, own TEACHER |
| POST | `/api/groups/:id/students` | SUPER_ADMIN, ADMIN |
| DELETE | `/api/groups/:id/students/:studentId` | SUPER_ADMIN, ADMIN |
| PATCH | `/api/groups/:id/students/:studentId/graduate` | SUPER_ADMIN, ADMIN |

Create group request:

```json
{
  "name": "Frontend N15",
  "courseId": "uuid",
  "teacherId": "uuid",
  "roomId": "uuid",
  "weekdays": ["MON", "WED", "FRI"],
  "time": "18:00",
  "startDate": "2026-07-01"
}
```

Backend должен сам посчитать `endDate` на основе `course.durationMonths`.

---

## 10.7 Students module

Responsibilities:

- CRUD студентов;
- генерация studentCode;
- баланс;
- архив;
- заморозка;
- история посещаемости/оценок/платежей;
- импорт/экспорт позже.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/students` | SUPER_ADMIN, ADMIN, TEACHER own data |
| POST | `/api/students` | SUPER_ADMIN, ADMIN |
| GET | `/api/students/:id` | SUPER_ADMIN, ADMIN, own TEACHER |
| PATCH | `/api/students/:id` | SUPER_ADMIN, ADMIN |
| DELETE | `/api/students/:id` | SUPER_ADMIN, ADMIN |
| PATCH | `/api/students/:id/freeze` | SUPER_ADMIN, ADMIN |
| PATCH | `/api/students/:id/unfreeze` | SUPER_ADMIN, ADMIN |
| GET | `/api/students/:id/attendance` | SUPER_ADMIN, ADMIN, own TEACHER |
| GET | `/api/students/:id/transactions` | SUPER_ADMIN, ADMIN |
| GET | `/api/students/:id/exams` | SUPER_ADMIN, ADMIN, own TEACHER |

Student code format:

```txt
ST101, ST102, ST103 ...
```

Генерация должна быть защищена от дублей через unique constraint.

---

## 10.8 Leads module

Responsibilities:

- воронка лидов;
- статусы;
- конвертация лида в студента.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/leads` | SUPER_ADMIN, ADMIN |
| POST | `/api/leads` | SUPER_ADMIN, ADMIN |
| GET | `/api/leads/:id` | SUPER_ADMIN, ADMIN |
| PATCH | `/api/leads/:id` | SUPER_ADMIN, ADMIN |
| PATCH | `/api/leads/:id/status` | SUPER_ADMIN, ADMIN |
| POST | `/api/leads/:id/convert` | SUPER_ADMIN, ADMIN |
| DELETE | `/api/leads/:id` | SUPER_ADMIN, ADMIN |

Convert logic:

1. Проверить, что lead не converted.
2. Создать student.
3. Если указан groupId — добавить в группу.
4. Обновить lead status = CONVERTED.
5. Сохранить `convertedStudentId`.

---

## 10.9 Attendance module

Responsibilities:

- отметка посещаемости;
- рейтинг;
- homeworkDone;
- комментарий;
- списание баланса;
- начисление KPI;
- Telegram push.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/attendance` | SUPER_ADMIN, ADMIN, TEACHER own data |
| GET | `/api/attendance/group/:groupId/date/:date` | SUPER_ADMIN, ADMIN, own TEACHER |
| POST | `/api/attendance` | SUPER_ADMIN, ADMIN, own TEACHER |
| PATCH | `/api/attendance/:id` | SUPER_ADMIN, ADMIN |
| DELETE | `/api/attendance/:id` | SUPER_ADMIN, ADMIN |

Bulk save attendance request:

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

Important rules:

1. Один student в одной group на одну date может иметь только одну attendance запись.
2. Если запись уже существует, нельзя создать дубль.
3. Если attendance уже создал admin и `lockedByAdmin = true`, teacher не может изменить.
4. Billing запускается только при первом создании или при изменении статуса, если это влияет на списание.
5. Нельзя списывать деньги два раза за одну и ту же attendance.

---

## 10.10 BillingService

BillingService — критически важный доменный сервис.

### 10.10.1 Daily billing formula

```txt
lessonPrice = course.pricePerMonth / lessonsCountInMonth
```

Где `lessonsCountInMonth` считается по weekdays группы в конкретном месяце.

### 10.10.2 Когда списывать

| Attendance status | Списание |
|---|---|
| CAME | да |
| ABSENT | да |
| EXCUSED | нет |

### 10.10.3 Что происходит при списании

1. Рассчитать `lessonPrice`.
2. Создать transaction:
   - type: `EXPENSE`;
   - category: `STUDENT_LESSON_CHARGE`;
   - source: `ATTENDANCE`;
   - sourceId: `attendance.id`.
3. Обновить `student.balance = student.balance - lessonPrice`.
4. Запустить KPI начисление преподавателю.
5. Создать уведомление родителю, если нужно.

### 10.10.4 Idempotency

Перед созданием transaction проверить:

```txt
source = ATTENDANCE AND sourceId = attendance.id
```

Если такая transaction уже есть, повторно не списывать.

---

## 10.11 KPI Service

### 10.11.1 Percent KPI

```txt
teacherAmount = lessonPrice * teacher.kpiRate / 100
```

### 10.11.2 Logic

При списании за урок:

1. Найти teacher группы.
2. Проверить salaryType.
3. Рассчитать KPI.
4. Увеличить `teacher.salaryBalance`.
5. Записать audit log.

### 10.11.3 Salary payout

Endpoint:

```http
POST /api/teachers/:id/payout
```

Request:

```json
{
  "amount": 1200000,
  "comment": "July payout"
}
```

Logic:

1. Проверить, что amount > 0.
2. Проверить, что amount <= salaryBalance.
3. Создать transaction:
   - type: `EXPENSE`;
   - category: `TEACHER_SALARY`.
4. Уменьшить salaryBalance или обнулить при full payout.

---

## 10.12 Finance module

Responsibilities:

- оплаты студентов;
- ручные доходы/расходы;
- книга KIRIM-CHIQIM;
- долги;
- выплаты преподавателям.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/transactions` | SUPER_ADMIN, ADMIN |
| POST | `/api/transactions` | SUPER_ADMIN, ADMIN |
| POST | `/api/payments/student` | SUPER_ADMIN, ADMIN |
| GET | `/api/finance/debtors` | SUPER_ADMIN, ADMIN |
| GET | `/api/finance/summary` | SUPER_ADMIN, ADMIN |

Student payment request:

```json
{
  "studentId": "uuid",
  "amount": 500000,
  "comment": "Payment for July"
}
```

Logic:

1. Создать transaction:
   - type: `INCOME`;
   - category: `STUDENT_PAYMENT`.
2. Увеличить student.balance.
3. Отправить Telegram уведомление родителю, если привязан.

---

## 10.13 Exams module

Responsibilities:

- создание экзамена;
- ввод результатов;
- ranking;
- Telegram push родителю;
- история экзаменов.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/exams` | SUPER_ADMIN, ADMIN, TEACHER own data |
| POST | `/api/exams` | SUPER_ADMIN, ADMIN, TEACHER own group |
| GET | `/api/exams/:id` | SUPER_ADMIN, ADMIN, own TEACHER |
| PATCH | `/api/exams/:id` | SUPER_ADMIN, ADMIN, own TEACHER |
| DELETE | `/api/exams/:id` | SUPER_ADMIN, ADMIN |
| POST | `/api/exams/:id/results` | SUPER_ADMIN, ADMIN, own TEACHER |
| GET | `/api/exams/:id/results` | SUPER_ADMIN, ADMIN, own TEACHER |

Save results request:

```json
{
  "results": [
    {
      "studentId": "uuid",
      "score": 87,
      "comment": "Good result"
    }
  ]
}
```

Backend должен пересчитать rank по группе.

---

## 10.14 Announcements module

Responsibilities:

- рассылки родителям;
- таргетинг по всем, группе или курсу;
- логирование статусов доставки.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/announcements` | SUPER_ADMIN, ADMIN |
| POST | `/api/announcements` | SUPER_ADMIN, ADMIN |
| GET | `/api/announcements/:id` | SUPER_ADMIN, ADMIN |

Create request:

```json
{
  "targetType": "GROUP",
  "targetId": "uuid",
  "title": "Exam reminder",
  "body": "Tomorrow exam at 18:00"
}
```

---

## 10.15 Telegram module

Responsibilities:

- Telegram webhook;
- `/start`;
- привязка родителя к studentCode;
- pending requests;
- approve/reject;
- push notifications.

Endpoints:

| Method | URL | Access |
|---|---|---|
| POST | `/api/telegram/webhook` | Telegram only |
| GET | `/api/telegram/links/pending` | SUPER_ADMIN, ADMIN |
| PATCH | `/api/telegram/links/:id/approve` | SUPER_ADMIN, ADMIN |
| PATCH | `/api/telegram/links/:id/reject` | SUPER_ADMIN, ADMIN |
| GET | `/api/telegram/links` | SUPER_ADMIN, ADMIN |

Telegram linking flow:

1. Parent sends `/start`.
2. Bot asks for studentCode.
3. Parent sends `ST101`.
4. Backend finds student.
5. Backend creates `TelegramLink` with status `PENDING`.
6. Admin sees pending request.
7. Admin approves.
8. Status becomes `ACTIVE`.
9. Parent receives success message.

Push triggers:

| Event | Message |
|---|---|
| ABSENT attendance | пропуск без причины |
| homeworkDone = false | домашнее задание не выполнено |
| exam result saved | результат экзамена |
| payment accepted | оплата принята |
| debt reminder | напоминание о долге |
| announcement | объявление |

---

## 10.16 Reports module

Responsibilities:

- аналитика для админки;
- CSV/Excel/PDF позже;
- серверная фильтрация по датам и статусам.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/reports/revenue-dynamics` | SUPER_ADMIN, ADMIN |
| GET | `/api/reports/debtors` | SUPER_ADMIN, ADMIN |
| GET | `/api/reports/attendance` | SUPER_ADMIN, ADMIN |
| GET | `/api/reports/exams` | SUPER_ADMIN, ADMIN |
| GET | `/api/reports/kirim-chiqim` | SUPER_ADMIN, ADMIN |

Query params:

```txt
?from=2026-07-01&to=2026-07-31
```

---

## 10.17 Dashboard module

Responsibilities:

- главные метрики;
- графики;
- данные по учебному центру.

Endpoint:

```http
GET /api/dashboard/summary
```

Response:

```json
{
  "success": true,
  "data": {
    "monthlyRevenue": 12000000,
    "totalRevenue": 85000000,
    "activeStudents": 230,
    "debtorsCount": 28,
    "groupsCount": 17,
    "teachersCount": 9,
    "leadConversionRate": 32.5,
    "moneyChart": [],
    "attendanceChart": []
  }
}
```

Teacher dashboard должен показывать только свои группы/студентов.

---

## 10.18 Settings module

Responsibilities:

- название центра;
- logo upload;
- billing mode;
- white label настройки.

Endpoints:

| Method | URL | Access |
|---|---|---|
| GET | `/api/settings` | SUPER_ADMIN, ADMIN |
| PATCH | `/api/settings` | SUPER_ADMIN, ADMIN |
| POST | `/api/settings/logo` | SUPER_ADMIN, ADMIN |

Logo validation:

- только PNG/JPG/JPEG;
- максимум 5MB;
- желательно 256x256;
- проверять MIME, а не только расширение.

---

## 11. Валидация

Использовать Zod.

Пример:

```ts
export const createStudentSchema = z.object({
  body: z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    phone: z.string().optional(),
    parentPhone: z.string().optional(),
    birthDate: z.string().optional()
  })
});
```

Middleware:

```ts
validate(createStudentSchema)
```

Валидация нужна для:

- body;
- params;
- query;
- headers, если для endpoint нужны специальные служебные заголовки.

---

## 12. Pagination, filtering, sorting

Все большие списки должны поддерживать:

```txt
?page=1&limit=20&search=ali&status=ACTIVE&sortBy=createdAt&sortOrder=desc
```

Modules:

- students;
- teachers;
- groups;
- leads;
- transactions;
- attendance;
- exams;
- announcements.

Default:

```txt
page = 1
limit = 20
max limit = 100
```

---

## 13. Security requirements

1. Пароли хранить только как bcrypt hash.
2. Access token короткий: 15 минут.
3. Refresh token длинный: 30 дней.
4. Refresh token хранить в БД как hash.
5. Rate limit на auth endpoints.
6. CORS только для frontend domain.
7. Helmet middleware.
8. Никогда не возвращать `passwordHash`.
9. Проверять role на каждом endpoint.
10. Teacher access проверять не только по role, но и по ownership.
11. Финансовые операции логировать.
12. Все ошибки писать в logger, но не отдавать stack trace на production.

---

## 14. Audit log

Для production-уровня добавить audit таблицу.

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  action    String
  entity    String
  entityId  String?
  before    Json?
  after     Json?
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())
}
```

Логировать обязательно:

- изменение баланса;
- платежи;
- выплаты зарплаты;
- изменение ролей;
- блокировку пользователя;
- удаление/архивирование важных сущностей;
- изменение настроек центра.

---

## 15. Testing requirements

### 15.1 Unit tests

Обязательно покрыть:

- BillingService;
- KpiService;
- AuthService;
- permission helpers;
- studentCode generator;
- date helpers for lessons count.

### 15.2 Integration tests

Проверить:

- login;
- create student;
- create group;
- save attendance;
- payment;
- teacher access only own data;
- duplicate attendance does not double charge.

### 15.3 Critical test cases

1. `EXCUSED` не списывает деньги.
2. `CAME` списывает деньги один раз.
3. Повторное сохранение attendance не создаёт второй transaction.
4. Teacher не видит чужую группу.
5. Student balance после payment увеличивается.
6. Student balance после attendance уменьшается.
7. Teacher salaryBalance увеличивается после списания.
8. Salary payout создаёт expense transaction.

---

## 16. Seed data

Создать `prisma/seed.ts`.

Seed должен создавать:

- super admin;
- 1 admin;
- 3 teachers;
- 3 courses;
- 4 rooms;
- 5 groups;
- 30 students;
- group-student связи;
- sample leads;
- sample attendance;
- sample transactions.

Default accounts:

```txt
SUPER_ADMIN
login: superadmin
password: superadmin123

ADMIN
login: admin
password: admin123

TEACHER
login: teacher1
password: teacher123
```

Пароли в seed тоже должны хэшироваться.

---

## 17. NPM scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write .",
    "test": "jest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:seed": "tsx prisma/seed.ts"
  }
}
```

---

## 18. Recommended package list

```bash
npm install express cors helmet dotenv bcrypt jsonwebtoken zod multer pino pino-http @prisma/client telegraf
npm install -D typescript tsx ts-node prisma jest ts-jest supertest eslint prettier @types/express @types/cors @types/bcrypt @types/jsonwebtoken @types/multer @types/supertest
```

---

## 19. Development roadmap

### Stage 0 — Backend foundation

- Node.js + Express + TypeScript setup;
- env config;
- Prisma setup;
- PostgreSQL connection;
- global error handler;
- response format;
- Swagger setup;
- logger.

### Stage 1 — Database and auth

- Prisma schema;
- migrations;
- seed;
- Auth module;
- JWT;
- refresh tokens;
- roles middleware.

### Stage 2 — Core academic modules

- users;
- teachers;
- courses;
- rooms;
- groups;
- students;
- group-student relations.

### Stage 3 — Attendance + billing

- attendance save;
- duplicate protection;
- BillingService;
- KpiService;
- transactions;
- balance updates.

### Stage 4 — Finance

- student payments;
- manual income/expense;
- debtors;
- salary payout;
- KIRIM-CHIQIM.

### Stage 5 — Leads and exams

- leads funnel;
- convert lead to student;
- exams;
- exam results;
- ranking.

### Stage 6 — Telegram

- bot setup;
- webhook or polling;
- studentCode linking;
- approve/reject links;
- notifications.

### Stage 7 — Dashboard and reports

- dashboard summary;
- revenue dynamics;
- attendance analytics;
- debtors report;
- exam analytics.

### Stage 8 — Hardening

- tests;
- audit log;
- rate limiting;
- Swagger complete;
- performance optimization;
- indexes;
- production env guide.

---

## 20. Backend acceptance criteria

Backend считается готовым для подключения frontend, когда:

1. Frontend может логиниться через real API.
2. Роли работают корректно.
4. Teacher видит только свои группы и студентов.
5. CRUD основных сущностей работает.
6. Attendance сохраняется и влияет на balance.
7. Payment увеличивает balance.
8. KPI преподавателя начисляется.
9. Reports возвращают реальные данные.
10. Telegram parent linking работает.
11. Swagger описывает все endpoints.
12. Seed создаёт demo-данные для проверки frontend.
13. Ошибки возвращаются в едином формате.
14. Нет открытых endpoint'ов без auth, кроме login/refresh/telegram webhook.

---

## 21. Что не делать на первом этапе

Чтобы не усложнять старт, временно не делать:

- Docker;
- Kubernetes;
- Redis queue;
- сложный WebSocket;
- PDF export;
- Excel export;
- email notifications;
- online payment gateway;
- full CI/CD;
- microservices.

Но архитектура должна быть такой, чтобы это можно было добавить позже без переписывания всего проекта.

---

## 22. Senior notes

1. Не смешивать controller и business logic.
2. Не писать Prisma-запросы прямо в routes.
3. Не доверять frontend-фильтрам.
4. Все money values хранить как Decimal, не float.
5. Все даты хранить в UTC; формат даты должен быть единым во всём проекте.
6. Для каждого сложного действия использовать transaction:
   - attendance + billing + KPI;
   - payment + balance update;
   - salary payout + transaction update.
7. Для удаления использовать soft delete там, где данные важны.
8. Не удалять финансовые операции физически.
9. Любое изменение финансов должно иметь audit log.
10. Swagger писать параллельно с endpoint'ами, а не в конце.

---

## 23. Minimum first implementation order

Если делать одному, начинать строго так:

1. Setup проекта.
2. Prisma schema.
3. Seed.
4. Auth.
6. Roles middleware.
7. Courses.
8. Teachers.
9. Groups.
10. Students.
11. Attendance.
12. Billing.
13. Finance.
14. Dashboard.
15. Telegram.

Такой порядок позволит быстро заменить frontend mock data настоящими API и не сломать архитектуру.

---

## 24. Финальный результат backend

На выходе должен быть production-ready monolith backend:

```txt
Node.js + Express + TypeScript
PostgreSQL + Prisma
JWT Auth + RBAC
Single-center access control
Academic CRM modules
Attendance + Billing + KPI
Finance reports
Telegram parent notifications
Swagger docs
Seed demo data
Tests for critical business logic
```

Этот backend должен быть достаточно чистым, чтобы позже без боли добавить:

- Docker;
- Redis/BullMQ;
- WebSocket;
- CI/CD;
- exports;
- production deployment.
