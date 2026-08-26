import { CalendarCheck, Clock3, MapPin, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTeacherDashboard } from '../features/teacher-dashboard/useTeacherDashboard'

export function TeacherDashboardPage() {
  const query = useTeacherDashboard()
  const data = query.data

  return (
    <section className="dashboard-page teacher-dashboard-page">
      <div className="page-heading"><div><h1>O'qituvchi paneli</h1><p>{data ? data.teacherName : "Bugungi darslar va guruhlar holati"}</p></div></div>
      {query.isPending ? <div className="dashboard-state">Ma'lumotlar yuklanmoqda...</div> : null}
      {query.isError ? <div className="dashboard-state dashboard-error">Ma'lumotlarni yuklab bo'lmadi</div> : null}
      {data ? <>
        <div className="stats-grid">
          <Link className="stat stat-link" to="/schedule"><span className="stat-icon stat-green"><UsersRound size={20} /></span><div><p>Faol guruhlar</p><strong>{data.activeGroups}</strong></div></Link>
          <Link className="stat stat-link" to="/rating"><span className="stat-icon stat-blue"><UsersRound size={20} /></span><div><p>O'quvchilar</p><strong>{data.activeStudents}</strong></div></Link>
          <Link className="stat stat-link" to="/schedule"><span className="stat-icon stat-gold"><Clock3 size={20} /></span><div><p>Bugungi darslar</p><strong>{data.todayLessons}</strong></div></Link>
          <Link className="stat stat-link" to="/attendance"><span className="stat-icon stat-violet"><CalendarCheck size={20} /></span><div><p>Davomat</p><strong>{data.attendancePercent}%</strong></div></Link>
        </div>
        <article className="panel lessons-panel"><header><h2>Yaqin darslar</h2></header><div className="lesson-list">{data.upcomingLessons.map((lesson) => <Link aria-label={`${lesson.groupName} davomatini ochish`} className="lesson lesson-link" key={lesson.id} to={`/attendance?group=${lesson.groupId}`}><time>{lesson.time}</time><div><strong>{lesson.groupName}</strong><span>{lesson.courseName}</span></div><span><MapPin size={13} /> {lesson.room}</span></Link>)}</div></article>
      </> : null}
    </section>
  )
}
