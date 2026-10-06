import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CalendarCheck,
  Check,
  ChevronDown,
  GraduationCap,
  TrendingDown,
  TrendingUp,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import type { AttendanceTrendPoint } from '@golden-study/contracts'

import { useDashboard } from '../features/dashboard/useDashboard'
import { getSession } from '../features/auth/auth.service'

const statIcons = [UsersRound, GraduationCap, CalendarCheck, WalletCards]

const PERIOD_OPTIONS = [
  { value: 30, label: 'Oxirgi 30 kun' },
  { value: 14, label: 'Oxirgi 14 kun' },
  { value: 7, label: 'Oxirgi 7 kun' },
]

function PeriodSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (val: number) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = PERIOD_OPTIONS.find((opt) => opt.value === value) || PERIOD_OPTIONS[0]

  return (
    <div className="period-selector-container" ref={containerRef}>
      <button
        type="button"
        className="period-selector-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown
          size={13}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease',
          }}
        />
      </button>
      {isOpen && (
        <div className="period-selector-menu" role="listbox">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`period-selector-item ${opt.value === value ? 'active' : ''}`}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              role="option"
              aria-selected={opt.value === value}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AttendanceChart({
  data,
  period,
}: {
  data?: AttendanceTrendPoint[]
  period: number
}) {
  const pointsList = data && data.length > 0 ? data : []
  const count = pointsList.length

  if (count === 0) {
    return (
      <div className="chart" aria-label="Davomat dinamikasi grafigi">
        <svg viewBox="0 0 700 110" role="img" aria-label="Davomat foizi">
          <line x1="0" y1="20" x2="700" y2="20" />
          <line x1="0" y1="52" x2="700" y2="52" />
          <line x1="0" y1="85" x2="700" y2="85" />
        </svg>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, padding: '10px 0' }}>
          Oxirgi {period} kunda davomat qayd etilmagan
        </div>
      </div>
    )
  }

  const coordinates = pointsList.map((p, i) => {
    const x = count > 1 ? Math.round(25 + (i / (count - 1)) * 650) : 350
    const y = Math.round(85 - (p.rate / 100) * 65)
    return { x, y, ...p }
  })

  const polylineStr = coordinates.map((c) => `${c.x},${c.y}`).join(' ')

  const labelIndices =
    count <= 6
      ? coordinates.map((_, i) => i)
      : [0, Math.floor(count * 0.25), Math.floor(count * 0.5), Math.floor(count * 0.75), count - 1]

  const displayedLabels = coordinates.filter((_, i) => labelIndices.includes(i))

  return (
    <div className="chart" aria-label="Davomat dinamikasi grafigi">
      <svg viewBox="0 0 700 110" role="img" aria-label="Davomat foizi">
        <line x1="0" y1="20" x2="700" y2="20" />
        <line x1="0" y1="52" x2="700" y2="52" />
        <line x1="0" y1="85" x2="700" y2="85" />
        {polylineStr ? (
          <>
            <polyline points={polylineStr} style={{ transition: 'all 250ms ease' }} />
            {coordinates.map((c) => (
              <circle
                key={c.date}
                cx={c.x}
                cy={c.y}
                r="3.5"
                fill="var(--gold)"
                style={{ transition: 'cx 250ms ease, cy 250ms ease' }}
              >
                <title>{`${c.label}: ${c.rate}% (${c.came}/${c.total} qatnashdi)`}</title>
              </circle>
            ))}
          </>
        ) : null}
      </svg>
      <div className="chart-labels">
        {displayedLabels.map((c) => (
          <span key={c.date}>{c.label}</span>
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<number>(30)
  const dashboardQuery = useDashboard()
  const data = dashboardQuery.data
  const isSuperAdmin = getSession()?.role === 'superadmin'
  const statPaths = isSuperAdmin
    ? ['/students', '/courses', '/attendance', '/finance']
    : ['/students', '/courses', '/attendance', '/students']

  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const cutoffTime = todayEnd.getTime() - period * 24 * 60 * 60 * 1000

  const trendData = (data?.attendanceTrend ?? []).filter((item) => {
    const itemTime = new Date(item.date).getTime()
    return itemTime >= cutoffTime
  })

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
          if (index === 3 && !isSuperAdmin) return null
          const Icon = statIcons[index]
          const isNegative = stat.change.startsWith('-')
          const TrendIcon = isNegative ? TrendingDown : TrendingUp
          return (
            <Link className="stat stat-link" to={statPaths[index]} key={stat.label}>
              <span className={`stat-icon stat-${stat.tone}`}><Icon size={20} /></span>
              <div>
                <p>{stat.label}</p>
                <strong>{stat.value}</strong>
                <small><TrendIcon size={12} /> {stat.change} o‘tgan oyga nisbatan</small>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="dashboard-grid">
        <article className="panel attendance-panel">
          <header>
            <h2>Davomat dinamikasi</h2>
            <PeriodSelector value={period} onChange={setPeriod} />
          </header>
          <AttendanceChart data={trendData} period={period} />
        </article>
        <article className="panel lessons-panel">
          <header>
            <h2>Kutilayotgan darslar</h2>
            <Link to="/schedule" className="panel-header-link">Barchasi</Link>
          </header>
          <div className="lesson-list">
            {data.upcomingLessons.map((lesson) => (
              <Link to="/schedule" className="lesson-link" key={lesson.time} style={{ display: 'block' }}>
                <div className="lesson">
                  <time>{lesson.time}<small>{lesson.date || 'Bugun'}</small></time>
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
