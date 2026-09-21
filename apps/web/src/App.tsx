import { Navigate, Route, Routes } from 'react-router-dom'

import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { TeachersPage } from './pages/TeachersPage'
import { CoursesPage } from './pages/CoursesPage'
import { GroupsPage } from './pages/GroupsPage'
import { StudentsPage } from './pages/StudentsPage'
import { AttendancePage } from './pages/AttendancePage'
import { LeadsPage } from './pages/LeadsPage'
import { FinancePage } from './pages/FinancePage'
import { ReportsPage } from './pages/ReportsPage'
import { ExamsPage } from './pages/ExamsPage'
import { AnnouncementsPage } from './pages/AnnouncementsPage'
import { SchedulePage } from './pages/SchedulePage'
import { RatingPage } from './pages/RatingPage'
import { StaffPage } from './pages/StaffPage'
import { TelegramBotPage } from './pages/TelegramBotPage'
import { SettingsPage } from './pages/SettingsPage'
import { TeacherDashboardPage } from './pages/TeacherDashboardPage'
import { TeacherSchedulePage } from './pages/TeacherSchedulePage'
import { TeacherAttendancePage } from './pages/TeacherAttendancePage'
import { TeacherRatingPage } from './pages/TeacherRatingPage'
import { TeacherExamsPage } from './pages/TeacherExamsPage'
import { TeacherSalaryPage } from './pages/TeacherSalaryPage'
import { getSession } from './features/auth/auth.service'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { RoleRoute } from './routes/RoleRoute'
import { AppShell } from './widgets/app-shell/AppShell'

function HomePage() {
  return getSession()?.role === 'teacher' ? <TeacherDashboardPage /> : <DashboardPage />
}

function ScheduleHome() {
  return getSession()?.role === 'teacher' ? <TeacherSchedulePage /> : <SchedulePage />
}

function AttendanceHome() { return getSession()?.role === 'teacher' ? <TeacherAttendancePage /> : <AttendancePage /> }
function RatingHome() { return getSession()?.role === 'teacher' ? <TeacherRatingPage /> : <RatingPage /> }
function ExamsHome() { return getSession()?.role === 'teacher' ? <TeacherExamsPage /> : <ExamsPage /> }

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/schedule" element={<ScheduleHome />} />
          <Route path="/attendance" element={<AttendanceHome />} />
          <Route path="/rating" element={<RatingHome />} />
          <Route path="/exams" element={<ExamsHome />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Shared for superadmin, admin and teacher */}
          <Route element={<RoleRoute allowed={['superadmin', 'admin', 'teacher']} />}>
            <Route path="/students" element={<StudentsPage />} />
          </Route>

          {/* Shared for superadmin and admin */}
          <Route element={<RoleRoute allowed={['superadmin', 'admin']} />}>
            <Route path="/teachers" element={<TeachersPage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/telegram-bot" element={<TelegramBotPage />} />
          </Route>

          {/* Teacher ONLY */}
          <Route element={<RoleRoute allowed={['teacher']} />}>
            <Route path="/my-salary" element={<TeacherSalaryPage />} />
          </Route>

          {/* Superadmin ONLY */}
          <Route element={<RoleRoute allowed={['superadmin']} />}>
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
          <Route path="/:module" element={<HomePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
