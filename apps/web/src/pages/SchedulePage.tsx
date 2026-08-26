import type { Group } from '@golden-study/contracts'
import { AlertTriangle, CalendarDays, Clock3, Edit3, LayoutGrid, List, MapPin, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useGroups } from '../features/groups/useGroups'

type ScheduleView = 'cards' | 'calendar'
type ScheduleLesson = {
  id: string
  groupId?: string
  groupName: string
  course: string
  teacher: string
  room: string
  weekday: string
  time: string
  source: 'auto' | 'manual'
}

type RecurringScopeAction = {
  type: 'delete' | 'edit'
  lesson: ScheduleLesson
  pendingData?: FormData
}

const weekdays = ['Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha', 'Yak']

function lessonsFromGroups(groups: Group[]) {
  return groups
    .filter((group) => group.active)
    .flatMap((group) => group.weekdays.map((weekday) => ({
      id: `${group.id}-${weekday}`,
      groupId: group.id,
      groupName: group.name,
      course: group.course,
      teacher: group.teacher,
      room: group.room,
      weekday,
      time: group.time,
      source: 'auto' as const,
    })))
}

export function SchedulePage() {
  const groupsQuery = useGroups()
  const [view, setView] = useState<ScheduleView>('cards')
  const [weekday, setWeekday] = useState('all')
  const [teacher, setTeacher] = useState('all')
  const [room, setRoom] = useState('')
  const [search, setSearch] = useState('')

  // State for manual, cancelled, and overridden lessons
  const [manualLessons, setManualLessons] = useState<ScheduleLesson[]>([])
  const [cancelledAutoLessonIds, setCancelledAutoLessonIds] = useState<Set<string>>(new Set())
  const [customOverrides, setCustomOverrides] = useState<Map<string, ScheduleLesson>>(new Map())
  const [groupOverrides, setGroupOverrides] = useState<Map<string, Partial<Group>>>(new Map())

  // Modal states
  const [isAdding, setIsAdding] = useState(false)
  const [editingLesson, setEditingLesson] = useState<ScheduleLesson | null>(null)
  const [scopePrompt, setScopePrompt] = useState<RecurringScopeAction | null>(null)

  const rawGroups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])

  // Effective groups taking group-level updates into account
  const groups = useMemo(() => {
    return rawGroups.map((g) => {
      const override = groupOverrides.get(g.id)
      return override ? { ...g, ...override } : g
    })
  }, [rawGroups, groupOverrides])

  // Effective total lessons
  const lessons = useMemo(() => {
    const autoBase = lessonsFromGroups(groups)
    const effectiveAuto = autoBase
      .filter((l) => !cancelledAutoLessonIds.has(l.id))
      .map((l) => customOverrides.get(l.id) ?? l)

    return [...effectiveAuto, ...manualLessons]
  }, [groups, cancelledAutoLessonIds, customOverrides, manualLessons])

  const teachers = useMemo(() => Array.from(new Set(lessons.map((lesson) => lesson.teacher))).sort(), [lessons])
  const rooms = useMemo(() => Array.from(new Set(lessons.map((lesson) => lesson.room))).sort(), [lessons])

  const filtered = useMemo(() => lessons.filter((lesson) => {
    const query = search.toLowerCase()
    return (weekday === 'all' || lesson.weekday === weekday)
      && (teacher === 'all' || lesson.teacher === teacher)
      && (!room || room === 'all' || lesson.room === room)
      && (!query || `${lesson.groupName} ${lesson.course} ${lesson.teacher} ${lesson.room}`.toLowerCase().includes(query))
  }).sort((a, b) => weekdays.indexOf(a.weekday) - weekdays.indexOf(b.weekday) || a.time.localeCompare(b.time)), [lessons, room, search, teacher, weekday])

  // Action Handlers
  function handleAddLesson(data: FormData) {
    const lesson: ScheduleLesson = {
      id: `manual-${Date.now()}`,
      groupName: String(data.get('groupName') ?? ''),
      course: String(data.get('course') ?? ''),
      teacher: String(data.get('teacher') ?? ''),
      room: String(data.get('room') ?? ''),
      weekday: String(data.get('weekday') ?? 'Du'),
      time: String(data.get('time') ?? '09:00'),
      source: 'manual',
    }
    setManualLessons((items) => [lesson, ...items])
    setIsAdding(false)
  }

  function handleInitiateEdit(lesson: ScheduleLesson) {
    setEditingLesson(lesson)
  }

  function handleSaveEditForm(data: FormData) {
    if (!editingLesson) return

    if (editingLesson.groupId) {
      // Group-linked lesson (auto or previously custom-modified) -> prompt scope
      setScopePrompt({ type: 'edit', lesson: editingLesson, pendingData: data })
      setEditingLesson(null)
    } else {
      // Standalone manual lesson (not linked to any recurring group) -> direct update
      const updated: ScheduleLesson = {
        ...editingLesson,
        groupName: String(data.get('groupName') ?? editingLesson.groupName),
        course: String(data.get('course') ?? editingLesson.course),
        teacher: String(data.get('teacher') ?? editingLesson.teacher),
        room: String(data.get('room') ?? editingLesson.room),
        weekday: String(data.get('weekday') ?? editingLesson.weekday),
        time: String(data.get('time') ?? editingLesson.time),
      }
      setManualLessons((items) => items.map((l) => (l.id === editingLesson.id ? updated : l)))
      setEditingLesson(null)
    }
  }

  function handleInitiateDelete(lesson: ScheduleLesson) {
    if (lesson.groupId) {
      // Group-linked lesson -> prompt scope
      setScopePrompt({ type: 'delete', lesson })
    } else {
      // Standalone manual lesson -> direct delete
      setManualLessons((items) => items.filter((item) => item.id !== lesson.id))
    }
  }

  // Handle choice from RecurringScopeModal
  function handleApplyScope(scope: 'single' | 'future') {
    if (!scopePrompt) return
    const { type, lesson, pendingData } = scopePrompt

    if (type === 'delete') {
      if (scope === 'single') {
        // Faqat ushbu dars uchun -> cancel single lesson
        setCancelledAutoLessonIds((prev) => new Set(prev).add(lesson.id))
      } else if (scope === 'future' && lesson.groupId) {
        // Ushbu va barcha keyingi darslar uchun -> remove weekday from group
        const targetGroupId = lesson.groupId
        const targetGroup = groups.find((g) => g.id === targetGroupId)
        if (targetGroup) {
          const updatedWeekdays = targetGroup.weekdays.filter((w) => w !== lesson.weekday)
          setGroupOverrides((prev) => new Map(prev).set(targetGroupId, { weekdays: updatedWeekdays }))
        }
        setCancelledAutoLessonIds((prev) => {
          const next = new Set(prev)
          next.delete(lesson.id)
          return next
        })
      }
    } else if (type === 'edit' && pendingData) {
      const newCourse = String(pendingData.get('course') ?? lesson.course)
      const newTeacher = String(pendingData.get('teacher') ?? lesson.teacher)
      const newRoom = String(pendingData.get('room') ?? lesson.room)
      const newWeekday = String(pendingData.get('weekday') ?? lesson.weekday)
      const newTime = String(pendingData.get('time') ?? lesson.time)

      if (scope === 'single') {
        // Faqat ushbu dars uchun -> convert to custom override for this instance
        const override: ScheduleLesson = {
          ...lesson,
          course: newCourse,
          teacher: newTeacher,
          room: newRoom,
          weekday: newWeekday,
          time: newTime,
          source: 'manual',
        }
        setCustomOverrides((prev) => new Map(prev).set(lesson.id, override))
      } else if (scope === 'future' && lesson.groupId) {
        // Ushbu va barcha keyingi darslar uchun -> update group parameters and weekdays
        const targetGroupId = lesson.groupId
        const targetGroup = groups.find((g) => g.id === targetGroupId)
        const updatedWeekdays = targetGroup && newWeekday !== lesson.weekday
          ? Array.from(new Set(targetGroup.weekdays.map((w) => (w === lesson.weekday ? newWeekday : w))))
          : undefined

        setGroupOverrides((prev) => {
          const currentOverride = prev.get(targetGroupId) ?? {}
          return new Map(prev).set(targetGroupId, {
            ...currentOverride,
            course: newCourse,
            teacher: newTeacher,
            room: newRoom,
            time: newTime,
            ...(updatedWeekdays ? { weekdays: updatedWeekdays } : {}),
          })
        })
        setCustomOverrides((prev) => {
          const next = new Map(prev)
          next.delete(lesson.id)
          return next
        })
      }
    }

    setScopePrompt(null)
  }

  return (
    <section className="schedule-page">
      <div className="page-heading">
        <div>
          <h1>Dars jadvali</h1>
          <p>Aktiv guruhlar asosida avtomatik jadval va qo'shimcha darslar</p>
        </div>
        <button type="button" onClick={() => setIsAdding(true)}><Plus size={16} /> Dars qo'shish</button>
      </div>

      {groupsQuery.isPending && <div className="dashboard-state">Dars jadvali yuklanmoqda...</div>}
      {groupsQuery.isError && <div className="dashboard-state dashboard-error">Dars jadvali yuklanmadi</div>}

      <div className="schedule-toolbar">
        <label className="search-field"><Search size={16} /><input aria-label="Dars qidirish" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Guruh, kurs, o'qituvchi" /></label>
        <select aria-label="Hafta kuni" value={weekday} onChange={(event) => setWeekday(event.target.value)}><option value="all">Barcha kunlar</option>{weekdays.map((day) => <option key={day} value={day}>{day}</option>)}</select>
        <select aria-label="O'qituvchi" value={teacher} onChange={(event) => setTeacher(event.target.value)}><option value="all">Barcha o'qituvchilar</option>{teachers.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select aria-label="Auditoriya" value={room} onChange={(event) => setRoom(event.target.value)}><option value="all">Barcha xonalar</option>{rooms.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <div className="schedule-view-toggle" aria-label="Jadval ko'rinishi">
          <button type="button" className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}><LayoutGrid size={14} /> Kartochkalar</button>
          <button type="button" className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><List size={14} /> Kalendar</button>
        </div>
      </div>

      <div className="schedule-summary">
        <article><span><CalendarDays size={16} /></span><p>Haftalik darslar</p><strong>{lessons.length}</strong></article>
        <article><span><UserRound size={16} /></span><p>O'qituvchilar</p><strong>{teachers.length}</strong></article>
        <article><span><MapPin size={16} /></span><p>Auditoriyalar</p><strong>{rooms.length}</strong></article>
      </div>

      {view === 'cards' ? (
        <ScheduleCards lessons={filtered} onEdit={handleInitiateEdit} onDelete={handleInitiateDelete} />
      ) : (
        <ScheduleCalendar lessons={filtered} onEdit={handleInitiateEdit} onDelete={handleInitiateDelete} />
      )}

      {isAdding && (
        <ManualLessonModal groups={groups} lessons={lessons} close={() => setIsAdding(false)} save={handleAddLesson} />
      )}

      {editingLesson && (
        <ManualLessonModal groups={groups} lessons={lessons} initialLesson={editingLesson} close={() => setEditingLesson(null)} save={handleSaveEditForm} />
      )}

      {scopePrompt && (
        <RecurringScopeModal action={scopePrompt} close={() => setScopePrompt(null)} apply={handleApplyScope} />
      )}
    </section>
  )
}

function ScheduleCards({ lessons, onEdit, onDelete }: { lessons: ScheduleLesson[]; onEdit: (l: ScheduleLesson) => void; onDelete: (l: ScheduleLesson) => void }) {
  if (!lessons.length) return <div className="dashboard-state">Dars topilmadi</div>
  return <div className="schedule-cards">{lessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} onEdit={onEdit} onDelete={onDelete} />)}</div>
}

function ScheduleCalendar({ lessons, onEdit, onDelete }: { lessons: ScheduleLesson[]; onEdit: (l: ScheduleLesson) => void; onDelete: (l: ScheduleLesson) => void }) {
  return (
    <div className="schedule-calendar">
      {weekdays.map((day) => {
        const dayLessons = lessons.filter((lesson) => lesson.weekday === day)
        return <section key={day} className="schedule-day"><h2>{day}</h2>{dayLessons.length ? dayLessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} onEdit={onEdit} onDelete={onDelete} />) : <span>Dars yo'q</span>}</section>
      })}
    </div>
  )
}

function LessonCard({ lesson, onEdit, onDelete }: { lesson: ScheduleLesson; onEdit?: (l: ScheduleLesson) => void; onDelete?: (l: ScheduleLesson) => void }) {
  return (
    <article className="schedule-card">
      <header>
        <strong>{lesson.groupName}</strong>
        <div className="schedule-card-tags">
          <span className={lesson.source}>{lesson.source === 'auto' ? 'Auto' : "Qo'lda"}</span>
          {onEdit && (
            <button
              type="button"
              className="lesson-action-btn edit"
              title="Darsni tahrirlash"
              aria-label={`${lesson.groupName} darsini tahrirlash`}
              onClick={() => onEdit(lesson)}
            >
              <Edit3 size={13} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="lesson-action-btn delete"
              title="Darsni o'chirish"
              aria-label={`${lesson.groupName} darsini o'chirish`}
              onClick={() => onDelete(lesson)}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </header>
      <p>{lesson.course}</p>
      <div><span><CalendarDays size={13} />{lesson.weekday}</span><span><Clock3 size={13} />{lesson.time}</span></div>
      <div><span><UserRound size={13} />{lesson.teacher}</span><span><MapPin size={13} />{lesson.room}</span></div>
    </article>
  )
}

function ManualLessonModal({
  groups,
  lessons,
  initialLesson,
  close,
  save,
}: {
  groups: Group[]
  lessons: ScheduleLesson[]
  initialLesson?: ScheduleLesson
  close: () => void
  save: (data: FormData) => void
}) {
  const activeGroups = groups.filter((g) => g.active)
  const allCourses = useMemo(() => Array.from(new Set(activeGroups.map((g) => g.course))).sort(), [activeGroups])
  const allTeachers = useMemo(() => Array.from(new Set(activeGroups.map((g) => g.teacher))).sort(), [activeGroups])

  const initialGroup = activeGroups.find((g) => g.name === initialLesson?.groupName)
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroup?.id ?? '')
  const [course, setCourse] = useState(initialLesson?.course ?? '')
  const [teacher, setTeacher] = useState(initialLesson?.teacher ?? '')
  const [roomNum, setRoomNum] = useState(initialLesson?.room ? initialLesson.room.match(/\d+/)?.[0] ?? '' : '')
  const [weekday, setWeekday] = useState(initialLesson?.weekday ?? 'Du')
  const [time, setTime] = useState(initialLesson?.time ?? '')

  function handleGroupChange(groupId: string) {
    setSelectedGroupId(groupId)
    const g = activeGroups.find((gr) => gr.id === groupId)
    if (g) {
      setCourse(g.course)
      setTeacher(g.teacher)
      const num = g.room.match(/\d+/)?.[0] ?? ''
      setRoomNum(num)
    }
  }

  const selectedGroup = activeGroups.find((g) => g.id === selectedGroupId)
  const roomFormatted = roomNum ? `${roomNum}-xona` : ''

  const isTimeValid = useMemo(() => {
    if (!time) return true
    return time >= '08:00' && time <= '21:00'
  }, [time])

  const sameSlotLessons = useMemo(() => {
    if (!time) return []
    // Exclude current initial lesson when checking conflicts during edit
    return lessons
      .filter((l) => l.id !== initialLesson?.id)
      .filter((l) => l.weekday === weekday && (l.time === time || l.time.startsWith(time)))
  }, [lessons, weekday, time, initialLesson])

  const groupConflictLesson = useMemo(() => {
    if (!selectedGroup || !time) return null
    return sameSlotLessons.find((l) => l.groupName === selectedGroup.name)
  }, [sameSlotLessons, selectedGroup, time])

  const busyTeachersMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!time) return map
    sameSlotLessons.forEach((l) => map.set(l.teacher, l.groupName))
    return map
  }, [sameSlotLessons, time])

  const teacherConflictGroup = teacher && time ? busyTeachersMap.get(teacher) : null

  const busyRoomsMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!time) return map
    sameSlotLessons.forEach((l) => map.set(l.room, l.groupName))
    return map
  }, [sameSlotLessons, time])

  const roomConflictGroup = roomFormatted && time ? busyRoomsMap.get(roomFormatted) : null

  const hasAnyConflict = !selectedGroupId || !time || !isTimeValid || !!groupConflictLesson || !!teacherConflictGroup || !!roomConflictGroup || !roomNum

  const conflictList = useMemo(() => {
    const list: string[] = []
    if (!time) return list
    if (groupConflictLesson && selectedGroup) {
      list.push(`"${selectedGroup.name}" guruhida allaqachon dars bor (${time})`)
    }
    if (teacherConflictGroup && teacher) {
      list.push(`O'qituvchi ${teacher} allaqachon "${teacherConflictGroup}" guruhida dars o'tmoqda (${time})`)
    }
    if (roomConflictGroup && roomFormatted) {
      list.push(`Auditoriya ${roomFormatted} allaqachon "${roomConflictGroup}" guruhi tomonidan band (${time})`)
    }
    if (!isTimeValid && time) {
      list.push('Dars vaqti markaz ish vaqtidan tashqarida (08:00–21:00)')
    }
    return list
  }, [groupConflictLesson, selectedGroup, time, teacherConflictGroup, teacher, roomConflictGroup, roomFormatted, isTimeValid])

  return (
    <div className="modal-backdrop">
      <form className="modal-card compact-modal" role="dialog" aria-modal="true" onSubmit={(event) => {
        event.preventDefault()
        const fd = new FormData(event.currentTarget)
        if (selectedGroup) fd.set('groupName', selectedGroup.name)
        fd.set('room', roomFormatted)
        fd.set('weekday', weekday)
        fd.set('time', time)
        save(fd)
      }}>
        <header>
          <h2>{initialLesson ? "Darsni tahrirlash" : "Dars qo'shish"}</h2>
          <button type="button" aria-label="Yopish" onClick={close}><X size={18} /></button>
        </header>
        <div className="compact-modal-grid">
          <div>
            <label htmlFor="sched-group">Guruh</label>
            <select
              id="sched-group"
              name="groupId"
              required
              className={groupConflictLesson ? 'is-invalid' : ''}
              value={selectedGroupId}
              onChange={(e) => handleGroupChange(e.target.value)}
            >
              <option value="">Guruhni tanlang</option>
              {activeGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="sched-course">Kurs</label>
            <select id="sched-course" name="course" required value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">Kursni tanlang</option>
              {allCourses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="sched-teacher">O'qituvchi</label>
            <select
              id="sched-teacher"
              name="teacher"
              required
              className={teacherConflictGroup ? 'is-invalid' : ''}
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
            >
              <option value="">O'qituvchini tanlang</option>
              {allTeachers.map((t) => {
                const busyWith = busyTeachersMap.get(t)
                return <option key={t} value={t}>{t}{busyWith ? ` (Band)` : ''}</option>
              })}
            </select>
          </div>

          <div>
            <label htmlFor="sched-room">Auditoriya</label>
            <input
              id="sched-room"
              name="roomNum"
              type="number"
              min="1"
              required
              className={roomConflictGroup ? 'is-invalid' : ''}
              value={roomNum}
              onChange={(e) => setRoomNum(e.target.value)}
              placeholder="Xona raqami"
            />
          </div>

          <div>
            <label htmlFor="sched-weekday">Kun</label>
            <select id="sched-weekday" name="weekday" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              {weekdays.map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="sched-time">Vaqt</label>
            <input
              id="sched-time"
              name="time"
              type="time"
              required
              className={!isTimeValid ? 'is-invalid' : ''}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        {conflictList.length > 0 && (
          <div className="modal-conflict-banner" role="alert">
            <div className="modal-conflict-header">
              <AlertTriangle size={15} />
              <span>Jadvalda konflikt aniqlandi:</span>
            </div>
            <ul>
              {conflictList.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <button type="submit" disabled={hasAnyConflict}>Saqlash</button>
      </form>
    </div>
  )
}

function RecurringScopeModal({
  action,
  close,
  apply,
}: {
  action: RecurringScopeAction
  close: () => void
  apply: (scope: 'single' | 'future') => void
}) {
  const isDelete = action.type === 'delete'

  return (
    <div className="modal-backdrop">
      <div className="modal-card compact-modal recurring-scope-modal" role="dialog" aria-modal="true">
        <header>
          <h2>{isDelete ? "Darsni o'chirish" : "O'zgartirishni qo'llash"}</h2>
          <button type="button" aria-label="Yopish" onClick={close}><X size={18} /></button>
        </header>
        <div className="recurring-scope-content">
          <p className="recurring-scope-subtitle">
            <strong>{action.lesson.groupName}</strong> ({action.lesson.weekday}, {action.lesson.time})
          </p>
          <p className="recurring-scope-prompt">
            {isDelete ? "Ushbu darsni qanday o'chirmoqchisiz?" : "O'zgartirishlar qanday saqlansin?"}
          </p>
          <div className="recurring-scope-actions">
            <button type="button" className="scope-choice-btn single" onClick={() => apply('single')}>
              <strong>Faqat ushbu dars uchun</strong>
              <span>Faqat tanlangan kunga ta'sir qiladi (guruh jadvali buzilmaydi)</span>
            </button>
            <button type="button" className="scope-choice-btn future" onClick={() => apply('future')}>
              <strong>Ushbu va barcha keyingi darslar uchun</strong>
              <span>Guruhнинг постоянный расписаниеси янгиланади</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
