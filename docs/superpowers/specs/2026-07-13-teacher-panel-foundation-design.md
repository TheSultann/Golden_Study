# Teacher Panel Foundation

## Scope

Replace the unsupported `student` demo role with the `teacher` role required by the CRM specification.

## Behavior

- Teacher signs in with a dedicated mock account.
- First slice exposes only the teacher dashboard. Schedule, attendance, rating, and exams will be added one by one after their data is filtered by teacher ownership.
- Teacher dashboard shows only the current teacher's groups, students, and upcoming lessons.
- Admin-only routes reject direct teacher navigation and return to the teacher dashboard.

## Data flow

Teacher dashboard follows `UI -> TanStack Query -> TeacherDashboardRepository -> Mock/Api implementation`.
Shared request and response schemas live in `packages/contracts`.

## Verification

Cover login, navigation, personalized dashboard, and route RBAC with integration tests. Run test, lint, typecheck, and build.
