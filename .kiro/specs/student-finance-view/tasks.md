# Implementation Plan: Student Finance View

## Overview

Implement a "My Payments" section for the student dashboard. This includes a backend API endpoint (`GET /api/finance/my-payments`) restricted to authenticated students, and a frontend page with current month status card and payment history list. Navigation is added to the Sidebar for students only.

## Tasks

- [x] 1. Backend: Add studentOnly middleware and my-payments endpoint
  - [x] 1.1 Add `studentOnly` middleware to `Backend/middleware/auth.middleware.js`
    - Add `authMiddleware.studentOnly` function that checks `req.user.role === 'student'` and returns 403 if not
    - Follow the same pattern as existing `adminOnly` and `teacherOrAdmin` middleware
    - _Requirements: 1.3, 1.4_

  - [x] 1.2 Add `GET /api/finance/my-payments` route to `Backend/routes/finance.js`
    - Add route with middleware chain: `[auth, auth.studentOnly, cache(300)]`
    - Query `TuitionPayment.find({ student: req.user.userId })` with `.populate('group', 'name')` and `.sort({ billingPeriod: -1 }).lean()`
    - Map results to response DTO: `{ billingPeriod, amountDue, amountPaid, paymentDate, status, groupName }`
    - Place this route BEFORE the `router.get('/')` catch-all route to avoid conflicts
    - _Requirements: 1.1, 1.2, 1.5, 1.6_

  - [ ]* 1.3 Write unit tests for the my-payments endpoint in `Backend/tests/studentPayments.test.js`
    - Test 401 for unauthenticated requests
    - Test 403 for admin and teacher roles
    - Test 200 with empty array for student with no records
    - Test 200 with correct response shape and sorting for student with records
    - Test groupName is populated from Group document
    - Use existing `testUtils.js` helpers (`createUser`, `createGroup`, `authHeader`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.4 Write property test: API returns all student records sorted descending
    - Install `fast-check` as devDependency in `Backend/`
    - **Property 1: API returns all student records sorted descending by billingPeriod**
    - Generate random sets of TuitionPayment records with arbitrary billingPeriods, insert into DB, call API, verify all records returned and sorted descending
    - Minimum 100 iterations
    - **Validates: Requirements 1.1**

  - [ ]* 1.5 Write property test: API response contains all required fields with correct types
    - **Property 2: API response contains all required fields with correct types**
    - Generate random payment records with varying field values, call API, verify each response object has: billingPeriod (string "YYYY-MM"), amountDue (number), amountPaid (number), paymentDate (string or null), status (one of "unpaid"/"paid"/"overdue"), groupName (string)
    - Minimum 100 iterations
    - **Validates: Requirements 1.2**

- [x] 2. Checkpoint - Backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Frontend: Create StudentPaymentsPage and components
  - [x] 3.1 Create `CurrentStatusCard` component at `src/components/StudentPayments/CurrentStatusCard.jsx`
    - Create `src/components/StudentPayments/CurrentStatusCard.module.css` with status styles (statusPaid green, statusPending yellow, statusOverdue red, statusDefault gray)
    - Accept props: `payment`, `loading`, `error`, `onRetry`
    - Render loading spinner when `loading` is true
    - Render error message with retry button when `error` is set
    - Render paid state: FiCheckCircle icon, green styling, paid amount (2 decimal places), payment date as locale string
    - Render unpaid state: FiClock icon, yellow styling, amount due (2 decimal places)
    - Render overdue state: FiAlertCircle icon, red styling, overdue amount (2 decimal places)
    - Render no-invoice state (payment is null): FiFileText icon, neutral styling, informational message
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.2 Create `PaymentHistoryView` component at `src/components/StudentPayments/PaymentHistoryView.jsx`
    - Create `src/components/StudentPayments/PaymentHistoryView.module.css` with color-coded status badges
    - Accept props: `payments`, `loading`, `error`, `onRetry`
    - Render loading indicator when `loading` is true
    - Render error message with retry button when `error` is set; preserve previously displayed data if available
    - Render empty state message when `payments` array is empty and not loading
    - Render records list sorted by billingPeriod descending: formatted month/year string, amount due, amount paid, color-coded status badge
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.3 Create `StudentPaymentsPage` at `src/pages/StudentPaymentsPage.jsx`
    - Create `src/pages/StudentPaymentsPage.module.css`
    - Fetch data from `/api/finance/my-payments` on mount using the shared axios client from `src/api.js`
    - Manage `payments`, `loading`, `error` state
    - Derive current month payment: compute `currentPeriod` as "YYYY-MM" from current date, find matching record
    - Pass current payment to `CurrentStatusCard`
    - Pass full payments array to `PaymentHistoryView`
    - Implement retry function that resets error, sets loading, and re-fetches
    - Set 10-second timeout on the API request
    - _Requirements: 2.1, 2.6, 5.1, 5.2, 5.3, 5.4_

- [x] 4. Frontend: Add navigation and routing
  - [x] 4.1 Add "My Payments" navigation item to `src/components/Sidebar/Sidebar.jsx`
    - Add conditional rendering for `role === 'student'`: NavLink to `/my-payments` with FiDollarSign icon
    - Place it after the dashboard link and before settings
    - Use existing `styles.menuItem` and `styles.active` classes
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 4.2 Register student payments route in `src/App.jsx`
    - Add lazy import for `StudentPaymentsPage`
    - Add a student-only route for `/my-payments` path using `PrivateRouteWithLayout`
    - Ensure non-students accessing `/my-payments` are redirected to their default route
    - _Requirements: 4.3, 4.5_

- [x] 5. Checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The backend endpoint must be placed before the existing `GET /` route in `finance.js` to avoid route conflicts
- `fast-check` needs to be installed as a devDependency for property tests
- Frontend uses CSS Modules consistent with the rest of the project
- The existing `cache` middleware with user-scoped keys handles per-student caching automatically
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "3.1", "3.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "3.3"] },
    { "id": 3, "tasks": ["4.1", "4.2"] }
  ]
}
```
