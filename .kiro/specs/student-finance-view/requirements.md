# Requirements Document

## Introduction

Раздел «Мои платежи» для студенческого дашборда. Студенты смогут видеть статус оплаты за текущий месяц, историю платежей за прошлые периоды, суммы к оплате и оплаченные суммы. Данные берутся из существующей модели TuitionPayment. Бэкенд предоставляет новый API-эндпоинт, доступный только студентам. Фронтенд отображает информацию в виде отдельной секции или страницы в студенческом дашборде.

## Glossary

- **Student_Finance_API**: Бэкенд-эндпоинт, возвращающий данные об оплатах для авторизованного студента
- **Payment_History_View**: Фронтенд-компонент, отображающий список платежей студента за все периоды
- **Current_Status_Card**: Фронтенд-компонент, отображающий статус оплаты за текущий месяц
- **TuitionPayment**: Mongoose-модель, хранящая данные о счетах (student, group, billingPeriod, amountDue, amountPaid, paymentDate, status)
- **Billing_Period**: Строка формата 'YYYY-MM', определяющая месяц выставления счёта
- **Payment_Status**: Одно из значений: unpaid, paid, overdue (из модели) или no_invoice (счёт не выставлен)

## Requirements

### Requirement 1: Получение данных об оплатах студента

**User Story:** As a student, I want to retrieve my payment records via API, so that I can view my financial status in the dashboard.

#### Acceptance Criteria

1. WHEN an authenticated student sends a GET request to the Student_Finance_API, THE Student_Finance_API SHALL return a JSON array of all TuitionPayment records belonging to that student, sorted by billingPeriod in descending order, with HTTP 200 status code
2. THE Student_Finance_API SHALL include for each payment record the following fields: billingPeriod (String, format "YYYY-MM"), amountDue (Number), amountPaid (Number), paymentDate (Date ISO string or null if not yet paid), status (one of "unpaid", "paid", "overdue"), and groupName (String, populated from the referenced Group document's name field)
3. IF an unauthenticated user sends a request to the Student_Finance_API, THEN THE Student_Finance_API SHALL return HTTP 401 status code with a JSON body containing an error message indicating missing or invalid authentication
4. IF a user with a role other than "student" sends a request to the Student_Finance_API, THEN THE Student_Finance_API SHALL return HTTP 403 status code with a JSON body containing an error message indicating insufficient permissions
5. WHEN an authenticated student has no TuitionPayment records, THE Student_Finance_API SHALL return an empty JSON array with HTTP 200 status code
6. IF the Student_Finance_API encounters a database or internal error while retrieving payment records, THEN THE Student_Finance_API SHALL return HTTP 500 status code with a JSON body containing an error message indicating a server error, without exposing internal details

### Requirement 2: Отображение статуса оплаты за текущий месяц

**User Story:** As a student, I want to see my current month payment status at a glance, so that I know whether I need to make a payment.

#### Acceptance Criteria

1. WHEN the student opens the finance section, THE Current_Status_Card SHALL display the Payment_Status for the current Billing_Period (computed as the current year-month in YYYY-MM format) within 3 seconds of the section becoming visible
2. WHEN the Payment_Status is 'paid', THE Current_Status_Card SHALL display a success indicator (FiCheckCircle icon with statusPaid styling) along with the paid amount formatted as a numeric value with up to 2 decimal places and the payment date formatted as a locale date string
3. WHEN the Payment_Status is 'unpaid', THE Current_Status_Card SHALL display a pending indicator (FiClock icon with statusPending styling) along with the amount due formatted as a numeric value with up to 2 decimal places
4. WHEN the Payment_Status is 'overdue', THE Current_Status_Card SHALL display a warning indicator (FiAlertCircle icon with statusOverdue styling) along with the overdue amount formatted as a numeric value with up to 2 decimal places
5. WHEN no invoice exists for the current Billing_Period, THE Current_Status_Card SHALL display an informational indicator (FiFileText icon with statusDefault styling) and a text message indicating that no invoice has been issued for this period
6. IF the finance data request fails or times out after 10 seconds, THEN THE Current_Status_Card SHALL display an error message indicating that payment status could not be loaded and SHALL provide a retry action
7. WHILE the finance data is being fetched, THE Current_Status_Card SHALL display a loading indicator in place of the payment status content

### Requirement 3: Отображение истории платежей

**User Story:** As a student, I want to see my payment history for past months, so that I can track my financial records over time.

#### Acceptance Criteria

1. WHEN the student opens the finance section, THE Payment_History_View SHALL display a list of all TuitionPayment records belonging to the authenticated student, sorted by Billing_Period from newest to oldest
2. THE Payment_History_View SHALL display for each record: Billing_Period formatted as a locale-aware month and year string (e.g., "May 2026" or "Май 2026"), amount due, amount paid, and Payment_Status
3. WHEN the student has no payment history, THE Payment_History_View SHALL display an empty state message indicating that no payment records exist
4. THE Payment_History_View SHALL visually distinguish between paid, unpaid, and overdue records using color-coded status indicators, where each of the three statuses has a distinct background or text color
5. WHILE the payment history data is being fetched, THE Payment_History_View SHALL display a loading indicator in place of the records list
6. IF the payment history request fails, THEN THE Payment_History_View SHALL display an error message indicating that records could not be loaded and SHALL preserve any previously displayed data

### Requirement 4: Навигация к разделу финансов

**User Story:** As a student, I want to navigate to the finance section from my dashboard, so that I can easily access my payment information.

#### Acceptance Criteria

1. WHILE a user with the 'student' role is authenticated, THE Sidebar SHALL display a "My Payments" navigation item
2. WHILE a user with the 'teacher' or 'admin' role is authenticated, THE Sidebar SHALL NOT display the "My Payments" navigation item
3. WHEN the student clicks the "My Payments" navigation item, THE application SHALL navigate to the student payments route and display the student finance page within 1 second
4. WHEN the student is on the student payments page, THE Sidebar SHALL indicate the "My Payments" navigation item as active
5. IF a non-authenticated user or an authenticated user without the 'student' role attempts to access the student payments route, THEN THE application SHALL redirect the user to the default route for their role

### Requirement 5: Состояния загрузки и ошибок

**User Story:** As a student, I want to see appropriate feedback while data is loading or if an error occurs, so that I understand the current state of the interface.

#### Acceptance Criteria

1. WHILE the Student_Finance_API request is in progress, THE Payment_History_View SHALL display a loading indicator and SHALL NOT display payment data or an error message
2. IF the Student_Finance_API request fails, THEN THE Payment_History_View SHALL hide the loading indicator and display an error message indicating the reason for failure, along with a retry button
3. WHEN the student clicks the retry button, THE Payment_History_View SHALL display the loading indicator and re-send the request to the Student_Finance_API
4. WHEN the Student_Finance_API request succeeds after a retry, THE Payment_History_View SHALL hide the loading indicator and display the retrieved payment data
