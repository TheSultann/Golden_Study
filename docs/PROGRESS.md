# Журнал разработки

Этот файл хранит краткий контекст между сессиями. Обновлять после каждого завершённого изменения.

## 06.07.2026

### Сделано

- Изучено техническое задание `Golden_Study-CRM-TZ.md`.
- Создан корневой `AGENTS.md` с правилами разработки.
- Backend выбран: Node.js, Express.js, TypeScript, Prisma, PostgreSQL.
- Frontend выбран: React, Vite, TypeScript, Tailwind CSS, shadcn/ui.
- Зафиксирован один учебный центр без филиалов.
- Зафиксированы правила дат, UZS, биллинга, KPI и финансового журнала.
- Принят frontend-first подход: сначала мок-данные, затем постепенное подключение API.
- Docker отложен до подготовки деплоя.
- Добавлены требования к архитектуре, тестам и ведению этого журнала.
- Созданы `docs/architecture.md`, `docs/roadmap.md` и `docs/api-contracts.md`.
- Созданы `README.md`, `.gitignore` и `.env.example`.
- Инициализирован pnpm monorepo с `apps/web`, `apps/api`, `apps/bot` и `packages/contracts`.
- Создан React + Vite + TypeScript frontend.
- Подключены React Router, TanStack Query, Zustand и Zod.
- Настроены Vitest, Testing Library, lint, typecheck и build.
- Первый frontend-тест выполнен по циклу RED -> GREEN.
- Изучён проект `kimyoDUv2` как визуальный ориентир по компактности и лёгкой типографике.
- В `AGENTS.md` добавлены обязательные правила UI/UX без копирования чужого UX, компонентов и кода.
- Реализована mock-авторизация с защищённым маршрутом и выходом.
- Добавлены аккаунты `admin/admin123` и `student/student123`.
- Убраны кнопки быстрого выбора роли со страницы входа.
- Добавлены светлая и тёмная темы на navy/gold/ivory палитре.
- Добавлены состояния ошибки, показ/скрытие пароля и сохранение mock-сессии в localStorage.
- Утверждён и реализован компактный AppShell по navy/gold/ivory концепту.
- Добавлены role-based sidebar, topbar, тема, выход и мобильное выдвижное меню.
- Реализован Dashboard на мок-данных: KPI, график посещаемости, ближайшие занятия и последние платежи.
- Для студента скрыты административные пункты меню.
- Из sidebar удалены демонстрационные адрес и телефон.
- Реализован frontend-модуль `O‘qituvchilar` на mock-данных без изменения AppShell.
- Добавлены реестр, поиск, фильтр оплаты, профиль преподавателя, добавление, редактирование и смена активности.
- Поля и финансовые настройки преподавателя сверены с разделами 5, 6.2, 7 и 8.2 ТЗ.
- Модуль преподавателей переведён на `TanStack Query` и repository pattern.
- Добавлены `TeacherRepository`, `MockTeacherRepository` и готовый для подключения `ApiTeacherRepository`.
- Контракты преподавателей вынесены в `packages/contracts` и валидируются через Zod.
- Для подключения backend достаточно заменить binding repository; UI и hooks менять не требуется.
- В `AGENTS.md` закреплён обязательный data-layer для всех frontend-модулей: Query hooks + Repository + Mock/API implementations + общие Zod-контракты.
- Dashboard переведён со прямых mock-массивов на `TanStack Query` и `DashboardRepository`.
- Добавлены `MockDashboardRepository`, готовый `ApiDashboardRepository`, loading/error состояния и Zod-контракты Dashboard.
- Для подключения Dashboard API теперь достаточно заменить dependency binding.
- Реализован модуль `Kurslar` по разделу 6.3 ТЗ.
- Добавлены карточки курсов, поиск, фильтр статуса, создание, редактирование и активация/деактивация.
- Модуль сразу использует TanStack Query, `CourseRepository`, Mock/API реализации и общие Zod-контракты.
- Реализован модуль `Guruhlar` по разделу 6.4 ТЗ.
- Добавлены список, поиск, статусы, CRUD, курс, преподаватель, аудитория, дни, время, students counts и авторасчёт end date.
- `Guruhlar` использует Query + Repository + Mock/API + Zod.
- Реализован `O‘quvchilar`: ST-ID, active/frozen/graduate tabs, search, CRUD, groups, parent contacts, balance, status update.
- `O‘quvchilar` использует Query + Repository + Mock/API + Zod.
- Реализован `Davomat`: group/date, came/excused/absent, rating 1–5, homework, comment, save.
- `Davomat` использует Query + Repository + Mock/API + Zod; backend позже выполняет billing/push.
- Реализован `Lidlar`: funnel statuses, search, create, status move, conversion-ready API.
- `Lidlar` использует Query + Repository + Mock/API + Zod.
- В `Lidlar` добавлен drag-and-drop карточек между статусами.
- Форма лида теперь позволяет выбрать стартовый статус; конвертация в ученика требует подтверждения.
- Убрано подтверждение при переносе лида, включая статус `Ro‘yxatdan o‘tgan`.
- Поле стартового статуса перенесено рядом с полем преподавателя для компактности.
- Реализован frontend-модуль `Moliya` по разделам 6.12 и 8 ТЗ.
- Добавлены вкладки `To‘lovlar`, `Xarajatlar`, `Oyliklar`, `Kirim-chiqim`, `Qarzlar`.
- `Moliya` использует TanStack Query, `FinanceRepository`, Mock/API реализации и Zod-контракты.
- Раздел `Hisobotlar` оставлен отдельным read-only модулем для аналитики и экспорта.

### Проверка

- Документы и служебные файлы проверены чтением файлов.
- `pnpm test` — успешно, 13 тестов.
- `pnpm lint` — успешно.
- `pnpm typecheck` — успешно.
- `pnpm build` — успешно.
- API и bot пока содержат только workspace-заглушки без кода.
- Playwright: страница входа проверена при 1440x900, вход администратора и переход на защищённый маршрут успешны.
- Корневые scripts переведены на `corepack pnpm`, чтобы запуск работал без глобального pnpm в PATH.
- AppShell проверен Playwright при 1440x900 и 390x844; ошибок консоли нет.
- Добавлен smoke-тест открытия `Moliya`.
- `corepack pnpm test` — успешно, 14 тестов.
- `corepack pnpm lint` — успешно.
- `corepack pnpm typecheck` — успешно.
- `corepack pnpm build` — успешно.
- Форма `To‘lov qo‘shish` переведена на связанные searchable-поля группы и ученика.
- После выбора группы показываются только её активные ученики; подпись ученика содержит имя и `ST-ID`.
- Ручной ввод ID, имени ученика и группы удалён; repository получает стабильные `studentId` и `groupId`.
- Проверки после изменения: `corepack pnpm test` — 16 тестов, `lint`, `typecheck`, `build` — успешно.
- Нативный `datalist` в форме платежа заменён кастомным searchable combobox в стиле CRM.
- Добавлены фильтрация, keyboard navigation, empty state и выбранное состояние.
- Повторные проверки: 16 тестов, lint, typecheck и build — успешно.
- `Moliya` UX: вкладка `To‘lovlar` уточнена как история `O‘quvchi to‘lovlari`, кнопка `To‘lov qo‘shish` сделана заметной primary-кнопкой в блоке истории.
- Карточки финансов переставлены: `Sof foyda` идёт после `To‘lanadigan oylik` и получила зелёный акцент как прибыль.
- Повторные проверки: `corepack pnpm test` — 16 тестов, `lint`, `typecheck`, `build` — успешно.

### Следующий шаг

- `Moliya` разделён на операционные вкладки: платежи, расходы, зарплаты и неизменяемый журнал операций.
- Универсальная форма операции заменена отдельными формами платежа ученика и расхода.
- `Qarzlar` и аналитический `Kirim-chiqim` перенесены в read-only `Hisobotlar` по разделу 6.12 ТЗ.
- Добавлен маршрут и smoke-тест `Hisobotlar`.
- `corepack pnpm test` — успешно, 15 тестов.
- `corepack pnpm lint` — успешно.
- `corepack pnpm typecheck` — успешно.
- `corepack pnpm build` — успешно.

## 07.07.2026

### Сделано

- Проверен UX раздела `Moliya` по вкладкам `To‘lovlar` и `Xarajatlar`.
- Убран верхний дублирующий action `Yangi to‘lov/Yangi xarajat` из заголовка страницы.
- Действия создания оставлены только внутри контекстных вкладок: `To‘lov qo‘shish` и `Xarajat qo‘shish`.
- Кнопка `Xarajat qo‘shish` приведена к единому primary-стилю и больше не обрезается.
- Добавлен regression-тест на отсутствие дублей и корректную форму расхода.
- Во вкладке `Oyliklar` добавлена явная колонка `Amal` с заметной кнопкой `To‘lash`.
- После выплаты строка показывает `0 UZS` и disabled-состояние `To‘langan`.
- Добавлен regression-тест на выплату зарплаты из вкладки `Oyliklar`.

### Изменены файлы

- `apps/web/src/pages/FinancePage.tsx`
- `apps/web/src/index.css`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` — успешно, 18 тестов.
- `corepack pnpm lint` — успешно.
- `corepack pnpm typecheck` — успешно.
- `corepack pnpm build` — успешно.
- Chrome UI QA: `http://localhost:5173/finance`, вкладка `Xarajatlar`, кнопка `Xarajat qo‘shish`, модалка расхода.
- Chrome UI QA: `http://localhost:5173/finance`, вкладка `Oyliklar`, кнопка `To‘lash`, состояние `To‘langan`.

### Следующий шаг

- Продолжить ревизию `Moliya`: проверить логику зарплат, журнал операций и read-only отчёты.

- Следующий модуль: `Imtihonlar` или детализация `Moliya` после просмотра UI.

## 07.07.2026 - Imtihonlar

### Сделано

- Реализован frontend-модуль `Imtihonlar` по разделу 6.9 ТЗ.
- Добавлены архив экзаменов, выбор экзамена, статистика средний/макс/мин, таблица результатов, ранги, ввод баллов и комментариев.
- Добавлен Telegram-шаблон уведомления с переменными `{studentName} {examName} {score} {maxScore} {totalStudents} {rank}`.
- Модуль использует TanStack Query, `ExamRepository`, Mock/API реализации и общие Zod-контракты.
- Подключён маршрут `/exams`.

### Изменены файлы

- `packages/contracts/src/exams.ts`
- `packages/contracts/src/index.ts`
- `apps/web/src/mocks/exams.ts`
- `apps/web/src/features/exams/*`
- `apps/web/src/pages/ExamsPage.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/index.css`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` - успешно, 19 тестов.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.

## 07.07.2026 - Hisobotlar

### Сделано

- Раздел `Hisobotlar` приведён к разделу 6.12 ТЗ.
- Реализованы 5 вкладок: `Tushumlar`, `Qarzlar`, `Davomat`, `Imtihonlar`, `Kirim-chiqim`.
- Вместо заглушек добавлены read-only таблицы и сводки на текущих mock repositories.
- `Tushumlar` показывает платежи и простую динамику по датам.
- `Qarzlar` показывает ведомость должников.
- `Davomat` показывает академическую посещаемость.
- `Imtihonlar` показывает аналитику экзаменов: средний, максимум, минимум.
- `Kirim-chiqim` показывает книгу операций и чистую прибыль.
- Добавлены mock export actions `Excel`, `CSV`, `PDF`.
- Вкладки видны сразу, даже пока данные загружаются.

### Изменены файлы

- `apps/web/src/pages/ReportsPage.tsx`
- `apps/web/src/index.css`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` - успешно, 24 теста.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.

### Следующий шаг

- Посмотреть UI `Imtihonlar` в браузере на desktop/mobile и затем решить: добавить создание нового экзамена или перейти к следующему разделу.

## 07.07.2026 - Imtihon qo‘shish

### Сделано

- Кнопка `Imtihon qo‘shish` стала рабочей.
- Добавлена modal-форма создания экзамена: название, группа, дата, максимальный балл.
- Новый экзамен создаёт строки результатов по активным ученикам выбранной группы.
- После сохранения новый экзамен автоматически выбирается в архиве.
- Добавлен regression-тест создания экзамена.

### Изменены файлы

- `apps/web/src/pages/ExamsPage.tsx`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` - успешно, 20 тестов.
- `corepack pnpm lint` - успешно.

## 07.07.2026 - E’lonlar

### Сделано

- Реализован frontend-модуль `E’lonlar` по разделу 6.11 ТЗ.
- Добавлены общие Zod-контракты `announcements`.
- Добавлены `AnnouncementRepository`, `MockAnnouncementRepository`, готовый `ApiAnnouncementRepository` и Query hooks.
- Подключён маршрут `/announcements`.
- Добавлены список объявлений, поиск, форма отправки, таргетинг `all/group/course`, статусы доставки.
- Отправка на mock-слое имитирует очередь и завершает запись статусом `BOT_DELIVERED`.
- Для студента раздел доступен read-only без кнопки отправки.

### Изменены файлы

- `packages/contracts/src/announcements.ts`
- `packages/contracts/src/index.ts`
- `apps/web/src/mocks/announcements.ts`
- `apps/web/src/features/announcements/*`
- `apps/web/src/pages/AnnouncementsPage.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/index.css`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` - успешно, 22 теста.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.

### Следующий шаг

- Посмотреть UI `E’lonlar` в браузере на desktop/mobile и затем перейти к следующему разделу или уточнить создание backend-контракта.

## 07.07.2026 - E’lonlarni rejalashtirish

### Сделано

- В `E’lon yuborish` добавлен выбор времени отправки: `Hozir yuborish` или `Vaqt belgilash`.
- Добавлено поле `Rejalangan vaqt` для отложенной отправки.
- Контракт `announcements` расширен полем `scheduledAt` и статусом `scheduled`.
- Mock repository сохраняет будущие объявления как `Rejalangan`, текущие как `BOT_DELIVERED`.
- Добавлен regression-тест запланированной отправки.

### Изменены файлы

- `packages/contracts/src/announcements.ts`
- `apps/web/src/mocks/announcements.ts`
- `apps/web/src/features/announcements/mockAnnouncement.repository.ts`
- `apps/web/src/pages/AnnouncementsPage.tsx`
- `apps/web/src/index.css`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` - успешно, 23 теста.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.

## 07.07.2026 - Imtihon natijalarini saqlash

### Сделано

- Ввод баллов и комментариев больше не сохраняется автоматически по потере фокуса.
- Добавлен явный action `Natijalarni saqlash` в таблице результатов экзамена.
- Данные результатов копятся в локальном черновике и сохраняются через `ExamRepository`.
- Тест сохранения балла обновлён под явную кнопку сохранения.

### Изменены файлы

- `apps/web/src/pages/ExamsPage.tsx`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` - успешно, 20 тестов.
- `corepack pnpm lint` - успешно.
## 07.07.2026 - Placeholder bo'limlar

### Сделано

- Добавлены разделы из ТЗ без бизнес-логики: `Dars jadvali`, `Reyting`, `Xodimlar`, `Telegram Bot`.
- Подключены пункты sidebar и маршруты `/schedule`, `/rating`, `/staff`, `/telegram-bot`.
- Добавлены простые placeholder-страницы, чтобы разделы уже были на месте.
- Добавлен smoke-тест открытия 4 новых разделов.

### Изменены файлы

- `apps/web/src/widgets/app-shell/navigation.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/pages/SchedulePage.tsx`
- `apps/web/src/pages/RatingPage.tsx`
- `apps/web/src/pages/StaffPage.tsx`
- `apps/web/src/pages/TelegramBotPage.tsx`
- `apps/web/src/index.css`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` - успешно, 25 тестов.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.

### Следующий шаг

- Реализовать эти разделы по очереди через contracts + Query hooks + Repository + Mock/API.

## 07.07.2026 - Dars jadvali

### Сделано

- Placeholder `Dars jadvali` заменён рабочим frontend-разделом.
- Расписание автоматически строится из активных `Guruhlar`: дни недели, время, аудитория, курс, преподаватель.
- Добавлены режимы `Kartochkalar` и `Kalendar`.
- Добавлены фильтры по дню недели, преподавателю, аудитории и поиск.
- Добавлено ручное добавление разового занятия в локальный mock-state.
- Данные групп берутся через `useGroups`, без прямого импорта mock-массивов.
- Добавлен regression-тест автогенерации расписания, календаря и ручного добавления.

### Изменены файлы

- `apps/web/src/pages/SchedulePage.tsx`
- `apps/web/src/index.css`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` - успешно, 26 тестов.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.

### Следующий шаг

- При backend-интеграции вынести ручные занятия в отдельный contract/repository или расширить group schedule contract после согласования API.

## 07.07.2026 - Reyting

### Сделано

- Placeholder `Reyting` заменён рабочим frontend-разделом.
- Добавлен leaderboard учеников на основе существующих `Imtihonlar` и `Davomat`.
- Расчёт рейтинга в UI: средний процент экзаменов + бонус davomat rating + бонус uy vazifasi.
- Добавлены top-3 podium, сводка, таблица, звёзды, фильтр по группе и поиск по ученику/ST-ID.
- Данные берутся через `useExams` и `useAttendance`, без прямого импорта mock-массивов.
- Добавлен regression-тест открытия leaderboard, фильтра группы, поиска и звёзд.

### Изменены файлы

- `apps/web/src/pages/RatingPage.tsx`
- `apps/web/src/index.css`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` - успешно, 27 тестов.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.

### Следующий шаг

- Перед backend-интеграцией согласовать формулу рейтинга и вынести её в `packages/contracts` + repository contract.

## 07.07.2026 - Xodimlar

### Сделано

- Placeholder `Xodimlar` заменён рабочим frontend-разделом по ТЗ 6.10.
- Добавлены контракты `staff` в `packages/contracts`: роль, статус, профиль сотрудника.
- Добавлены `StaffRepository`, `MockStaffRepository`, готовый `ApiStaffRepository`, dependency binding и Query hooks.
- Добавлены mock-данные сотрудников: admin, manager, accountant, teacher-linked accounts.
- Реализованы таблица сотрудников, поиск, фильтры по роли/статусу, карточка профиля, создание, редактирование и блокировка/активация.
- Преподаватели отображаются как linked teacher accounts, но не дублируют модуль `O'qituvchilar`.
- Добавлен regression-тест списка, фильтра роли, блокировки и создания сотрудника.

### Изменены файлы

- `packages/contracts/src/staff.ts`
- `packages/contracts/src/index.ts`
- `apps/web/src/mocks/staff.ts`
- `apps/web/src/features/staff/*`
- `apps/web/src/pages/StaffPage.tsx`
- `apps/web/src/index.css`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` - успешно, 28 тестов.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.

### Следующий шаг

- Перед backend-интеграцией согласовать RBAC matrix по ролям `admin`, `manager`, `accountant`, `teacher` и endpoints `/staff`.

## 08.07.2026 - Telegram Bot

### Сделано

- Placeholder `Telegram Bot` заменён рабочим frontend-разделом по ТЗ 9.
- Добавлены контракты `telegram`: parent links, notification log, trigger types, queue metrics, bot service status.
- Добавлены `TelegramBotRepository`, `MockTelegramBotRepository`, готовый `ApiTelegramBotRepository`, dependency binding и Query hooks.
- Добавлены mock-данные Telegram links, notification log, queue metrics и bot heartbeat.
- Реализованы заявки на привязку родителей: `pending`, `active`, `rejected`, подтверждение и отклонение.
- Реализован queue/status overview: bot status, waiting/active/failed/sentToday.
- Реализован manual trigger для тестовой постановки notification в очередь.
- Реализованы notification log и список push trigger-типов.
- `E'lonlar` оставлен отдельным разделом рассылок, Telegram Bot отвечает за link approvals, очередь и журнал.
- Добавлен regression-тест подтверждения link и постановки test notification в queue.

### Изменены файлы

- `packages/contracts/src/telegram.ts`
- `packages/contracts/src/index.ts`
- `apps/web/src/mocks/telegram.ts`
- `apps/web/src/features/telegram/*`
- `apps/web/src/pages/TelegramBotPage.tsx`
- `apps/web/src/index.css`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` - успешно, 29 тестов.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.

### Следующий шаг

- Перед backend-интеграцией согласовать endpoints `/telegram-bot`, BullMQ job schema, idempotency key и webhook/long polling режим.

## 08.07.2026 - Sozlamalar

### Сделано

- Реализован frontend-раздел `Sozlamalar` по ТЗ 6.13 без filial/multi-branch логики, так как проект закреплен как один учебный центр.
- Добавлены контракты `settings` в `packages/contracts`: centerName, logoUrl, billingMode, timezone, currency, dateFormat.
- Добавлены `SettingsRepository`, `MockSettingsRepository`, готовый `ApiSettingsRepository`, dependency binding и TanStack Query hooks.
- Подключен маршрут `/settings`.
- Добавлен экран настроек: название центра, Logo URL, billing mode, read-only стандарты Asia/Tashkent, UZS, DD.MM.YYYY.
- Добавлен regression-тест открытия и сохранения настроек.

### Изменены файлы

- `packages/contracts/src/settings.ts`
- `packages/contracts/src/index.ts`
- `apps/web/src/mocks/settings.ts`
- `apps/web/src/features/settings/*`
- `apps/web/src/pages/SettingsPage.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/index.css`
- `apps/web/src/App.test.tsx`
- `docs/PROGRESS.md`

### Проверка

- `corepack pnpm test` - успешно, 30 тестов.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.

### Следующий шаг

- Перед backend-интеграцией согласовать endpoints `/settings` и отдельный upload-контракт для logo PNG/JPG 256x256 до 5 MB.
## 13.07.2026 - Teacher panel foundation

### Сделано

- Ошибочная demo-роль `student` заменена на предусмотренную ТЗ роль `teacher`.
- Добавлен route-level RBAC: преподаватель не открывает административные маршруты по прямому URL.
- Добавлен отдельный Dashboard преподавателя с его группами, учениками, посещаемостью и ближайшими уроками.
- Данные проходят через `TanStack Query -> TeacherDashboardRepository -> Mock/ApiRepository`.
- Добавлены общие Zod-контракты teacher dashboard и endpoint-заготовка `/teachers/me/dashboard`.

### Изменены файлы

- `packages/contracts/src/teacher-dashboard.ts`
- `apps/web/src/features/teacher-dashboard/*`
- `apps/web/src/pages/TeacherDashboardPage.tsx`
- `apps/web/src/routes/RoleRoute.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/App.test.tsx`
- `apps/web/src/features/auth/*`
- `apps/web/src/widgets/app-shell/navigation.ts`

### Проверка

- `corepack pnpm test` - успешно, 31 тест.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.
- Playwright: desktop и mobile 390x844, ошибок и предупреждений консоли нет.

### Следующий шаг

- Реализовать для преподавателя `Dars jadvali` с фильтрацией только по его занятиям.
## 13.07.2026 - Teacher schedule

### Сделано

- Добавлен read-only раздел `Dars jadvali` для преподавателя.
- Показываются только группы и уроки текущего преподавателя.
- Добавлены поиск, фильтр дня недели, карточки и календарный режим.
- Добавлены Zod-контракт, `TeacherScheduleRepository`, Mock/API реализации и Query hook.
- Подготовлен endpoint-контракт `GET /teachers/me/schedule`.

### Проверка

- `corepack pnpm test` - успешно, 32 теста.
- `corepack pnpm lint` - успешно, без предупреждений.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.
- Playwright: desktop 1440x900 и mobile 390x844, ошибок консоли нет.

### Следующий шаг

- Реализовать `Davomat` для преподавателя только по его группам.
## 13.07.2026 - Teacher attendance

### Сделано

- Добавлен раздел `Davomat` для преподавателя только по его группам.
- Реализованы статусы посещаемости, рейтинг, домашнее задание и комментарий.
- Строки, закрытые администратором, отображаются read-only.
- Добавлены `TeacherAttendanceRepository`, Mock/API реализации, Query hooks и Zod-контракт групп.
- Подготовлены endpoints `/teachers/me/attendance` и `/teachers/me/attendance/groups`.

### Проверка

- Vitest - успешно, 33 теста.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.
- Playwright: desktop 1440x900 и mobile 390x844, ошибок консоли нет.

### Следующий шаг

- Реализовать `Reyting` для преподавателя только по его ученикам.
## 13.07.2026 - Teacher rating

### Сделано

- Добавлен read-only раздел `Reyting` только по ученикам преподавателя.
- Добавлены поиск, фильтр группы, top-3, сводка и leaderboard.
- Добавлены Zod-контракт, `TeacherRatingRepository`, Mock/API реализации и Query hook.
- Подготовлен endpoint `GET /teachers/me/rating`.
- Исправлено нестабильное ожидание RBAC redirect в integration-тесте.

### Проверка

- Vitest - успешно, 34 теста.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно.
- Playwright: desktop 1440x900 и mobile 390x844, ошибок консоли нет.

### Следующий шаг

- Реализовать `Imtihonlar` для преподавателя по его группам.

## 13.07.2026 - Teacher exams

### Сделано

- Добавлен раздел `Imtihonlar` только по группам преподавателя.
- Реализованы создание экзамена, поиск, просмотр результатов и сохранение баллов с комментариями.
- Добавлены Zod-контракты, `TeacherExamsRepository`, Mock/API реализации и Query hooks.
- Подготовлены контракты endpoints `/teachers/me/exams` и `/teachers/me/exam-groups`.

### Проверка

- Vitest - успешно, 35 тестов.
- `corepack pnpm lint` - успешно.
- `corepack pnpm typecheck` - успешно.
- `corepack pnpm build` - успешно; есть предупреждение Vite о размере общего chunk.
- Playwright: desktop 1440x900 и mobile 390x844, ошибок и предупреждений консоли нет.

### Следующий шаг

- Провести итоговую проверку панели преподавателя и согласовать следующий модуль по ТЗ.

## 13.07.2026 - Teacher dashboard UI/UX review

### Сделано

- Убрано дублирующее имя преподавателя из содержимого страницы.
- Уплотнены карточки показателей на мобильных экранах.
- Ближайшие занятия сделаны кликабельными: переход открывает `Davomat` с нужной группой.
- В контракт занятия добавлен `groupId` для будущего API.

### Проверка

- Vitest - успешно, 36 тестов.
- `corepack pnpm --filter @golden-study/web lint` - успешно.
- `corepack pnpm --filter @golden-study/web typecheck` - успешно.
- Playwright: desktop 1440x900 и mobile 390x844; переход в группу `ENG-24-03` проверен; ошибок консоли нет.

### Следующий шаг

- Проверить и улучшить UI/UX раздела преподавателя `Davomat`.

## 14.07.2026 - Teacher attendance UI/UX review

### Сделано

- Мобильная таблица заменена адаптивными карточками без горизонтальной прокрутки.
- На мобильном доступны статус, рейтинг, домашнее задание и комментарий.
- Кнопка `Saqlash` показывает текст и име�- **Информационный круглый аватар**: Sidebar-превью профиля преподавателя сделан более эстетичным и профессиональным — аватар с инициалами теперь имеет круглую форму (`borderRadius: '50%'`), сама карточка осталась чисто информационной.
- **Удалена галерея из заголовка**: Из заголовка «Profil kartasi» удалена некорректная иконка галереи (`Image`) и заменена на иконку пользователя (`User`).
- **Блок статистики преподавателя**: Под специализацией («IELTS Instructor») добавлен аккуратный, разделенный чертой блок со статистикой преподавателя: `Guruhlar` (активные группы), `O'quvchilar` (активные студенты) и `Davomat` (процент посещаемости/успеваемости).
- **Поддержка options в хуке**: В хук `useTeacherDashboard` добавлена поддержка React Query `options` (в частности `enabled`), чтобы исключить запросы дашборда от имени администратора.
- **Компактный выбор языка**: Выпадающий список выбора интерфейсного языка («Interfeys tili») перенесен из отдельного громоздкого блока во всю ширину страницы внутрь общей формы личных данных («Shaxsiy ma'lumotlar»).
- **Симметричная сетка формы**: Селектор языка размещен в сетке `settings-grid` в одну строку рядом с Telegram username (Ряд 1: Ф.И.Ш., Ряд 2: Специализация | Телефон, Ряд 3: Telegram | Язык). Это позволило сэкономить экранное пространство и сделать форму аккуратной.
- **Сохранение состояния языка**: Выбранный язык теперь сохраняется и загружается из `localStorage` (`golden-study-lang`), предотвращая сброс при перезагрузке.
- **Исправлен тест роли преподавателя**: В `App.test.tsx` исправлена регрессионная проверка `скрывает административные разделы от преподавателя` (тест ошибочно ожидал скрытия раздела Sozlamalar для `teacher`, хотя они разрешены в `navigation.ts`).

### Проверка

- Unit и integration тесты: `corepack pnpm test` — 37 тестов успешно пройдено.
- Проверка линтера: `corepack pnpm lint` — 0 ошибок и предупреждений.
- Проверка типов: `corepack pnpm typecheck` — успешно.
- Сборка проекта: `corepack pnpm build` — успешно.

### Следующий шаг

- Ожидание команды пользователя.

## 15.07.2026 - Согласован UX-дизайн разделов Kurslar и Guruhlar

### Сделано

- Изучены текущие страницы, стили, hooks и repository-поток разделов.
- Согласован сбалансированный UX-подход: кликабельные карточки/строки, отдельные статусные действия, подтверждение рискованных операций, полные состояния интерфейса и mobile-адаптация.
- Создана спецификация `docs/superpowers/specs/2026-07-15-courses-groups-ux-design.md`.

### Проверка

- Код не изменялся; тестовые команды не запускались.

### Следующий шаг

- После подтверждения спецификации подготовить план реализации.
�ет.

### Следующий шаг

- Проверить и улучшить UI/UX раздела преподавателя `Reyting`.

## 14.07.2026 - Teacher rating UI/UX review

### Сделано

- Мобильные сводка и top-3 уплотнены в одну строку.
- Leaderboard преобразуется в адаптивные карточки без горизонтальной прокрутки.
- На мобильном отображаются все показатели, включая звёзды и итоговый балл.
- Звёздному рейтингу добавлена доступная подпись с именем ученика.

### Проверка

- Целевой Vitest - успешно; фильтрация группы и пересчёт результатов проверены.
- `corepack pnpm --filter @golden-study/web lint` - успешно.
- `corepack pnpm --filter @golden-study/web typecheck` - успешно.
- Playwright mobile 390x844: полный leaderboard и фильтр `ENG-24-03`; ошибок консоли нет.

### Следующий шаг

- Проверить и улучшить UI/UX раздела преподавателя `Imtihonlar`.

## 14.07.2026 - Teacher exams UI/UX review

### Сделано

- Мобильная сводка уплотнена в сетку 2×2.
- Таблица результатов преобразуется в карточки без горизонтальной прокрутки.
- Баллы, проценты и комментарии полностью доступны на мобильном.
- Даты отображаются в формате `DD.MM.YYYY`, API-данные остаются ISO.
- Страница экзаменов приведена к читаемой структуре без изменения бизнес-логики.

### Проверка

- Добавлен тест создания экзамена только для собственной группы преподавателя.
- Целевые Vitest - успешно.
- `corepack pnpm --filter @golden-study/web lint` - успешно.
- `corepack pnpm --filter @golden-study/web typecheck` - успешно.
- Playwright mobile 390x844: результаты и форма создания; ошибок консоли нет.

### Следующий шаг

- Провести итоговую сквозную проверку всей панели преподавателя.

## 14.07.2026 - Teacher exams browser feedback

### Сделано

- Заголовок результатов выровнен; группа и дата оформлены отдельной строкой.
- Кнопка сохранения перенесена под список результатов и растягивается на мобильном.
- Поле поиска увеличено до 44 px; исправлено flex-сжатие на узком экране.
- Исправлена регрессия ширины поиска: desktop 100%, mobile 100% при высоте 44 px.

### Проверка

- Vitest, lint и typecheck - успешно.
- Playwright 520x698: поиск 44 px, заголовок без наложений, кнопка сохранения внизу.

### Следующий шаг

- Продолжить проверку панели преподавателя по замечаниям пользователя.

## 14.07.2026 - Davomat, dars jadvali va imtihonlar yaxshilanishi

### Сделано

- **Выравнивание select стрелки**: Добавлен глобальный сброс `appearance: none` и кастомная SVG стрелка-галочка для всех `select` элементов. В результате во всех разделах (включая фильтры расписания и посещаемости) выпадающие списки отображаются идеально ровно.
- **Позиционирование кнопки «Saqlash» в посещаемости**: На страницах посещаемости (`TeacherAttendancePage.tsx` и `AttendancePage.tsx`) кнопка переноса и статусы сохраненности перенесены в самый конец таблицы в блок `.attendance-actions`. На десктопе они аккуратно прижаты к правому краю, на мобильных устройствах — выстраиваются в столбик и кнопка растягивается на 100% ширины.
- **Динамический счетчик «Bugungi darslar»**: Исправлен баг в расписании преподавателя (`TeacherSchedulePage.tsx`), где фильтр уроков на сегодня был захардкожен на `'Du'` (понедельник). Теперь день недели вычисляется динамически на основе текущей даты.
- **Аккуратный счетчик студентов на карточках**: Текст `14 o'quvchi` заменен на аккуратную иконку `<UsersRound size={11} /> 14`, что исключает перенос на две строки на карточках и выглядит более компактно и аккуратно.
- **Добавлены предупреждения `isDirty` и `showSuccess` в экзамены**: В `TeacherExamsPage.tsx` внедрено отслеживание несохраненных изменений в черновике оценок и вывод баджа `Saqlandi!` при успешном сохранении.

### Проверка

- Запущены все unit и integration тесты: `corepack pnpm test` — 37 тестов успешно пройдено (исправлена нестабильность теста редиректа через замену `getByRole` на `await findByRole`).
- Успешно выполнена сборка проекта: `corepack pnpm build`.
- Проверена адаптивность карточек в календаре.

### Следующий шаг

- Ожидание команды пользователя для перехода к следующему разделу.

## 14.07.2026 - Ulug‘langan reyting va mobil jadvallar yaxshilanishi

### Сделано

- **Убран дублирующий подиум**: Из разделов `RatingPage.tsx` и `TeacherRatingPage.tsx` удален дублирующий блок карточек `rating-podium` (первые 3 места), так как эти данные уже выводятся в Leaderboard.
- **Подсветка 1-го места в Leaderboard**: Добавлен класс `.place-1` для первой строки таблицы. На десктопе строка выделяется золотым фоном, а место `#1` оформлено золотой плашкой. На мобильных устройствах первая карточка имеет золотую рамку и премиальный золотистый градиент.
- **Дизайн мобильных таблиц**: Для таблиц посещаемости (`.attendance-table`), оценок (`.exams-table`) и рейтинга (`.rating-table`) фон `tbody` на мобильных экранах изменен на `var(--surface-soft)` (серый), а карточки `tr` получили белый фон `var(--surface)` и мягкую тень `box-shadow`. Это делает карточки контрастными и легко отличимыми друг от друга. Также убраны лишние нижние границы у последних ячеек карточек.

### Проверка

- Unit и integration тесты: `corepack pnpm test` — 37 тестов успешно пройдено.
- Сборка проекта: `corepack pnpm build` — успешно.
- Chrome UI QA: проверено отображение карточек рейтинга и посещаемости на мобильном разрешении.

### Следующий шаг

- Ожидание команды пользователя.

## 14.07.2026 - Kontrastli 1-o‘rin va premium chegaralar

### Сделано

- **Увеличен контраст 1-го места в Leaderboard**: Непрозрачность золотистого фона `.place-1` увеличена с 3% до 7% (`rgb(212 160 23 / 7%)`), что делает строку четко отличимой на любых мониторах.
- **Левый золотой бордюр**: Первой ячейке (`td:first-child`) первой строки добавлен вертикальный золотой разделитель толщиной 3px (`border-left: 3px solid var(--gold)`), визуально притягивающий взгляд к победителю.
- **Более насыщенный бадж #1**: Текст места `#1` сделан более контрастным (цвет `var(--gold-dark)`), а фон и рамка баджа стали более теплыми и видимыми.
- **Улучшение мобильного выделения**: Градиент первого места на мобильном увеличен до 7.5% непрозрачности золотого, добавлено мягкое свечение рамки `box-shadow: 0 0 0 1px rgba(212, 160, 23, 0.15)`.

### Проверка

- Unit и integration тесты: `corepack pnpm test` — 37 тестов успешно пройдено.
- Сборка проекта: `corepack pnpm build` — успешно.

### Следующий шаг

- Ожидание команды пользователя.

## 14.07.2026 - Imtihonlarda o‘quvchi ismi ustuvorligi

### Сделано

- **Приоритет имени над ID**: В результатах экзаменов (`TeacherExamsPage.tsx` и `ExamsPage.tsx`) в таблицах изменен порядок отображения ученика. Теперь имя ученика (Sardor Abdullayev) отображается жирным основным шрифтом (`<strong>`), а идентификатор (ST101) выводится под ним меньшим серым шрифтом (`<span>`). Это значительно повысило читаемость списков для учителей и администраторов.

### Проверка

- Unit и integration тесты: `corepack pnpm test` — 37 тестов успешно пройдено.
- Сборка проекта: `corepack pnpm build` — успешно.

### Следующий шаг

- Ожидание команды пользователя.

## 14.07.2026 - Mobil kartochkalar kontrastini oshirish

### Сделано

- **Более плотные рамки**: Для мобильных карточек `tr` в таблицах посещаемости, экзаменов и рейтинга граница сделана более темной и заметной (`border: 1.5px solid #d2cbbd`), а также добавлена более выраженная тень (`box-shadow: 0 2px 6px rgba(0,0,0,0.04)`). Теперь карточки четко отделяются друг от друга.
- **Цветовое выделение шапки карточки**: 
  - На мобильных карточках посещаемости первая ячейка (с именем ученика) получила мягкий фоновый цвет `var(--surface-soft)`.
  - На мобильных карточках экзаменов первые две ячейки (с рангом и именем ученика) выделены фоновым цветом `var(--surface-soft)`.
  - На мобильных карточках рейтинга первые две ячейки также выделены `var(--surface-soft)`, а для победителя (первое место) — мягким золотистым фоном (`rgb(212 160 23 / 10%)`).
  - Это визуально группирует информацию, создавая красивую «шапку» для каждого блока.

### Проверка

- Unit и integration тесты: `corepack pnpm test` — 37 тестов успешно пройдено.
- Сборка проекта: `corepack pnpm build` — успешно.

### Следующий шаг

- Ожидание команды пользователя.

## 14.07.2026 - Yaxshilangan rang kontrastlari va yorqin statuslar

### Сделано

- **Яркие и контрастные статусы**: Все уведомления и кнопки статусов переведены с тусклых блеклых оттенков на профессиональные контрастные цвета для высокой читаемости:
  - **Успех / Сохранено / Доставлено (`came`, `save-success`, `bot_delivered`)**: Цвет `#15803d` (сочный зеленый), фон `rgb(34 197 94 / 12%)`, рамка `rgb(34 197 94 / 30%)`.
  - **Предупреждение / Не сохранено / В очереди (`excused`, `unsaved-badge`, `queued`, `scheduled`)**: Цвет `#b45309` (насыщенный янтарно-оранжевый), фон `rgb(245 158 11 / 12%)`, рамка `rgb(245 158 11 / 30%)`.
  - **Ошибка / Отсутствует / Ошибка отправки (`absent`, `failed`)**: Цвет `#b91c1c` (ярко-красный), фон `rgb(239 68 68 / 12%)`, рамка `rgb(239 68 68 / 30%)`.
  - **Шрифт**: Для выбранных кнопок статусов и баджей установлен `font-weight: 600`.

### Проверка

- Unit и integration тесты: `corepack pnpm test` — 37 тестов успешно пройдено.
- Сборка проекта: `corepack pnpm build` — успешно.

### Следующий шаг

- Ожидание команды пользователя.

## 14.07.2026 - Рефакторинг настроек преподавателя

### Сделано

- **Удалена загрузка фото**: Из страницы настроек преподавателя (`SettingsPage.tsx` для `isTeacher === true`) полностью удалена кнопка «Rasm yuklash» (Загрузить фото) и обработчик `uploadAvatar` согласно требованиям.
- **Информационный круглый аватар**: Sidebar-превью профиля преподавателя сделан более эстетичным и профессиональным — аватар с инициалами теперь имеет круглую форму (`borderRadius: '50%'`), сама карточка осталась чисто информационной.
- **Компактный выбор языка**: Выпадающий список выбора интерфейсного языка («Interfeys tili») перенесен из отдельного громоздкого блока во всю ширину страницы внутрь общей формы личных данных («Shaxsiy ma'lumotlar»).
- **Симметричная сетка формы**: Селектор языка размещен в сетке `settings-grid` в одну строку рядом с Telegram username (Ряд 1: Ф.И.Ш., Ряд 2: Специализация | Телефон, Ряд 3: Telegram | Язык). Это позволило сэкономить экранное пространство и сделать форму аккуратной.
- **Сохранение состояния языка**: Выбранный язык теперь сохраняется и загружается из `localStorage` (`golden-study-lang`), предотвращая сброс при перезагрузке.
- **Исправлен тест роли преподавателя**: В `App.test.tsx` исправлена регрессионная проверка `скрывает административные разделы от преподавателя` (тест ошибочно ожидал скрытия раздела Sozlamalar для `teacher`, хотя они разрешены в `navigation.ts`).

### Проверка

- Unit и integration тесты: `corepack pnpm test` — 37 тестов успешно пройдено.
- Проверка линтера: `corepack pnpm lint` — 0 ошибок и предупреждений.
- Проверка типов: `corepack pnpm typecheck` — успешно.
- Сборка проекта: `corepack pnpm build` — успешно.

### Следующий шаг

- Кнопка выхода в сайдбаре: В футер сайдбара (Sidebar.tsx) интегрирована кнопка LogOut c hover-эффектами.
- Интеграция выхода в AppShell: Обработчик прокинут в Sidebar через onLogout.

### Проверка

- Тесты, линт, тайпчек, сборка успешно пройдены (37 тестов).

### Следующий шаг

- Кнопка «Yangi guruh» на дашборде ведет на /groups?action=new, автоматически открывая модалку создания.
- Кнопки «Barchasi» ведут на /schedule и /finance.
- Карточки уроков и строки платежей стали кликабельными (с hover-эффектами).
- Кнопка создания адаптирована под мобильные (только иконка при сужении).
- Проверки: typecheck, lint, build и test (37 passed) ок.

### Следующий шаг

- Кнопка «O‘qituvchi qo‘shish» переведена на Link с query-параметром ?action=new для автооткрытия формы добавления.
- Теги групп в профиле преподавателя (боковая панель) сделаны кликабельными ссылками, ведущими на /groups?search=GroupName.
- Добавлен размытый полупрозрачный задний фон (backdrop) для карточки преподавателя на экранах до 1180px.
- Проверки: lint, typecheck, build и unit/integration-тесты (37 шт.) успешно пройдены.

### Следующий шаг

- Исправлено открытие модалки добавления преподавателя при клике на Link с помощью useEffect для синхронизации.
- Поле поиска (search-field) теперь занимает 100% ширины на мобильных устройствах глобально.
- Тесты (37 passed) и линтер пройдены.

### Следующий шаг

- Добавлена автоматическая генерация логина и пароля в форму создания нового преподавателя.
- Добавлена кнопка «Ma’lumotlarni nusxalash» для копирования сгенерированных доступов.
- Тесты (37 passed) и линтер успешно пройдены.

### Следующий шаг

- Ожидание команды пользователя.
