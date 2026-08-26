# Telegram Bot: mobile UX

## Цель

Убрать визуально сломанный summary, горизонтальную прокрутку таблиц и дублирующие служебные блоки на mobile.

## Решение

- Summary-карточки получают структуру `icon + content`; label/value/meta остаются одним блоком.
- Mobile summary отображается компактной сеткой 2×2.
- Заявки на подключение превращаются на mobile в подписанные карточки без horizontal scroll.
- `Tasdiqlash` и `Rad etish` располагаются ровной action-группой внизу карточки.
- `Tasdiqlash` — зелёная primary-кнопка; `Rad etish` — красная outline-кнопка с равными размерами.
- В данных ученика сначала показывается имя, ниже — `ST-ID`.
- Журнал уведомлений превращается на mobile в подписанные карточки.
- Удаляется служебный текст под выбором test trigger.
- Удаляется дублирующий раздел `Push triggerlar`.
- `Manual trigger` переименовывается в `Test xabari`, `Trigger` — в `Xabar turi`.
- `Notification log` переименовывается в `Xabarlar jurnali`.
- Английская подпись `Parent Telegram link approvals` заменяется понятной узбекской.
- Даты отображаются строго `DD.MM.YYYY` в `Asia/Tashkent`.

## Ограничения

- Repository, contracts, mutations и бизнес-логика не меняются.
- Карточки не получают ложную кликабельность.
- Browser/Playwright QA не выполняется по просьбе пользователя.

## Проверка

- Regression-тест структуры summary и отсутствия удалённых текстов/раздела.
- Regression-тест `data-label` для заявок и журнала.
- Responsive CSS-контракт: summary 2×2, таблицы без horizontal scroll, card/actions layout.
- Запустить `test`, `lint`, `typecheck`, `build`.
