import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarCheck, GraduationCap, TrendingUp, UsersRound, WalletCards } from 'lucide-react'

import { useDashboard } from '../features/dashboard/useDashboard'

const statIcons = [UsersRound, GraduationCap, CalendarCheck, WalletCards]
const statPaths = ['/students', '/courses', '/attendance', '/finance']

function AttendanceChart() {
  const points = '0,55 28,70 56,64 84,72 112,48 140,61 168,43 196,68 224,59 252,74 280,46 308,58 336,39 364,50 392,42 420,57 448,36 476,49 504,32 532,45 560,37 588,51 616,35 644,44 672,31 700,49'
  return (
    <div className="chart" aria-label="Davomat dinamikasi grafigi">
      <svg viewBox="0 0 700 110" role="img" aria-label="Oxirgi 30 kun davomat foizi">
        <line x1="0" y1="25" x2="700" y2="25" /><line x1="0" y1="55" x2="700" y2="55" /><line x1="0" y1="85" x2="700" y2="85" />
        <polyline points={points} />
      </svg>
      <div className="chart-labels"><span>7 iyun</span><span>14 iyun</span><span>21 iyun</span><span>28 iyun</span><span>6 iyul</span></div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const dashboardQuery = useDashboard()
  const data = dashboardQuery.data

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1>Bosh sahifa</h1>
          <p>O‘quv markazining bugungi ko‘rsatkichlari</p>
        </div>
        <Link to="/groups?action=new" className="page-heading-button">
          <BookOpen size={16} /> Yangi guruh
        </Link>
      </div>

      {dashboardQuery.isPending ? <div className="dashboard-state">Dashboard yuklanmoqda...</div> : null}
      {dashboardQuery.isError ? <div className="dashboard-state dashboard-error">Dashboard ma’lumotlarini yuklab bo‘lmadi</div> : null}
      {data ? <>
      <div className="stats-grid">
        {data.stats.map((stat, index) => {
          const Icon = statIcons[index]
          return <Link className="stat stat-link" to={statPaths[index]} key={stat.label}><span className={`stat-icon stat-${stat.tone}`}><Icon size={20} /></span><div><p>{stat.label}</p><strong>{stat.value}</strong><small><TrendingUp size={12} /> {stat.change} o‘tgan oyга nisbatan</small></div></Link>
        })}
      </div>

      <div className="dashboard-grid">
        <article className="panel attendance-panel"><header><h2>Davomat dinamikasi</h2><select aria-label="Davr"><option>Oxirgi 30 kun</option></select></header><AttendanceChart /></article>
        <article className="panel lessons-panel">
          <header>
            <h2>Kutilayotgan darslar</h2>
            <Link to="/schedule" className="panel-header-link">Barchasi</Link>
          </header>
          <div className="lesson-list">
            {data.upcomingLessons.map((lesson) => (
              <Link to="/schedule" className="lesson-link" key={lesson.time} style={{ display: 'block' }}>
                <div className="lesson">
                  <time>{lesson.time}<small>6 iyul</small></time>
                  <div>
                    <strong>{lesson.title}</strong>
                    <span>{lesson.meta}</span>
                  </div>
                  <span>{lesson.room}</span>
                </div>
              </Link>
            ))}
          </div>
        </article>
      </div>

      <article className="panel payments-panel">
        <header>
          <h2>So‘nggi to‘lovlar</h2>
          <Link to="/finance" className="panel-header-link">Barchasi</Link>
        </header>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Sana</th>
                <th>O‘quvchi</th>
                <th>Kurs</th>
                <th>Summa</th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPayments.map((payment) => (
                <tr key={`${payment.date}-${payment.student}`} className="clickable-row" onClick={() => navigate('/finance')}>
                  <td>{payment.date}</td>
                  <td>{payment.student}</td>
                  <td>{payment.course}</td>
                  <td>{payment.amount}</td>
                  <td><span className={`status status-${payment.tone}`}>{payment.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      </> : null}
    </section>
  )
}
