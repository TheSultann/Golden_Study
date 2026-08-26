import { CalendarDays, Clock3, LayoutGrid, List, MapPin, Search, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { TeacherScheduleLesson } from '@golden-study/contracts'
import { useTeacherSchedule } from '../features/teacher-schedule/useTeacherSchedule'

const weekdays: TeacherScheduleLesson['weekday'][] = ['Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha', 'Yak']
const emptyLessons: TeacherScheduleLesson[] = []

export function TeacherSchedulePage() {
  const query = useTeacherSchedule()
  const [view, setView] = useState<'cards' | 'calendar'>('cards')
  const [weekday, setWeekday] = useState('all')
  const [search, setSearch] = useState('')
  const lessons = query.data ?? emptyLessons
  const filtered = useMemo(() => lessons.filter((lesson) => (weekday === 'all' || lesson.weekday === weekday) && `${lesson.groupName} ${lesson.courseName} ${lesson.room}`.toLowerCase().includes(search.toLowerCase())), [lessons, search, weekday])
  const groups = new Set(lessons.map((lesson) => lesson.groupName)).size

  const todayWeekday = useMemo(() => {
    const weekdaysMap = ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha']
    return weekdaysMap[new Date().getDay()]
  }, [])

  return <section className="schedule-page">
    <div className="page-heading"><div><h1>Dars jadvali</h1><p>Faqat sizga biriktirilgan guruhlar va darslar</p></div></div>
    {query.isPending ? <div className="dashboard-state">Dars jadvali yuklanmoqda...</div> : null}
    {query.isError ? <div className="dashboard-state dashboard-error">Dars jadvali yuklanmadi</div> : null}
    <div className="schedule-toolbar teacher-schedule-toolbar">
      <label className="search-field"><Search size={16} /><input aria-label="Dars qidirish" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Guruh, kurs yoki xona" /></label>
      <select aria-label="Hafta kuni" value={weekday} onChange={(event) => setWeekday(event.target.value)}><option value="all">Barcha kunlar</option>{weekdays.map((day) => <option key={day}>{day}</option>)}</select>
      <div className="schedule-view-toggle"><button type="button" aria-pressed={view === 'cards'} className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}><LayoutGrid size={14} /> Kartochkalar</button><button type="button" aria-pressed={view === 'calendar'} className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><List size={14} /> Kalendar</button></div>
    </div>
    <div className="schedule-summary"><article><span><CalendarDays size={16} /></span><p>Haftalik darslar</p><strong>{lessons.length}</strong></article><article><span><UsersRound size={16} /></span><p>Guruhlar</p><strong>{groups}</strong></article><article><span><Clock3 size={16} /></span><p>Bugungi darslar</p><strong>{lessons.filter((lesson) => lesson.weekday === todayWeekday).length}</strong></article></div>
    {view === 'cards' ? <div className="schedule-cards">{filtered.map((lesson) => <Lesson key={lesson.id} lesson={lesson} />)}</div> : <div className="schedule-calendar">{weekdays.map((day) => <section className="schedule-day" key={day}><h2>{day}</h2>{filtered.filter((lesson) => lesson.weekday === day).map((lesson) => <Lesson key={lesson.id} lesson={lesson} />)}</section>)}</div>}
    {!query.isPending && filtered.length === 0 ? <div className="dashboard-state">Dars topilmadi</div> : null}
  </section>
}

function Lesson({ lesson }: { lesson: TeacherScheduleLesson }) {
  return <Link aria-label={`${lesson.groupName} ${lesson.weekday} davomatini ochish`} className="schedule-card schedule-card-link" to={`/attendance?group=${lesson.groupId}`}><header><strong>{lesson.groupName}</strong><span className="auto"><UsersRound size={11} /> {lesson.studentsCount}</span></header><p>{lesson.courseName}</p><div><span><CalendarDays size={13} />{lesson.weekday}</span><span><Clock3 size={13} />{lesson.time}</span></div><div><span><MapPin size={13} />{lesson.room}</span></div></Link>
}
