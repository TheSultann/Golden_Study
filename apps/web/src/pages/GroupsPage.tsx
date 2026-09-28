import type { Group, Student } from '@golden-study/contracts'
import {
  CalendarCheck,
  CalendarDays,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Search,
  Send,
  UserMinus,
  UsersRound,
  X,
} from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCourses } from '../features/courses/useCourses'
import {
  useAddGroupStudent,
  useGroupStudents,
  useGroups,
  useRemoveGroupStudent,
  useSaveGroup,
  useSetGroupActive,
} from '../features/groups/useGroups'
import { TelegramGroupConnectModal } from '../features/groups/TelegramGroupConnectModal'
import { useRooms } from '../features/rooms/useRooms'
import { useTeachers } from '../features/teachers/useTeachers'
import { useStudents } from '../features/students/useStudents'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { DateInput, displayToIsoDate } from '../shared/ui/DateInput'
import { Pagination } from '../shared/ui/Pagination'
import { Select, type SelectOption } from '../shared/ui/Select'
import { formatApiError } from '../shared/api/errorTranslation'

const emptyGroups: Group[] = []

const weekdays = ['Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha']

function addMonths(date: string, months: number) {
  const value = new Date(`${date}T00:00:00`)
  value.setMonth(value.getMonth() + months)
  return value.toISOString().slice(0, 10)
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-')
  return year && month && day ? `${day}.${month}.${year}` : date
}

type GroupFormProps = {
  group?: Group
  pending: boolean
  errorMessage?: string | null
  close: () => void
  save: (group: Group) => void
}

function GroupForm({ group, pending, errorMessage, close, save }: GroupFormProps) {
  const teachersQuery = useTeachers()
  const coursesQuery = useCourses()
  const roomsQuery = useRooms()

  const [selectedTeacher, setSelectedTeacher] = useState(group?.teacher ?? '')
  const [selectedCourse, setSelectedCourse] = useState(group?.course ?? '')

  const [roomRaw, setRoomRaw] = useState(() => {
    if (!group?.room || group.room === 'Xona berilmagan') return ''
    return group.room.replace(/-xona$/i, '').replace(/^xona\s+/i, '').trim()
  })

  const availableTeachers = (teachersQuery.data ?? []).filter((teacher) => {
    const fullName = `${teacher.firstName} ${teacher.lastName}`.trim()
    return teacher.active || fullName === group?.teacher
  })

  const availableCourses = (coursesQuery.data ?? []).filter((course) => {
    return course.active || course.title === group?.course
  })

  const availableRooms = roomsQuery.data ?? []
  const trimmedRoom = roomRaw.trim()
  const formattedRoom = trimmedRoom ? (/^\d+$/.test(trimmedRoom) ? `${trimmedRoom}-xona` : trimmedRoom) : ''

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const startDate = displayToIsoDate(String(data.get('startDate')))
    save({
      id: group?.id ?? `new-${Date.now()}`,
      name: String(data.get('name')).trim(),
      course: String(data.get('course')).trim(),
      teacher: String(data.get('teacher')).trim(),
      room: formattedRoom || 'Xona berilmagan',
      weekdays: data.getAll('weekdays').map(String),
      time: String(data.get('time')),
      startDate,
      endDate: addMonths(startDate, Number(data.get('duration'))),
      activeStudents: group?.activeStudents ?? 0,
      graduateStudents: group?.graduateStudents ?? 0,
      active: group?.active ?? true,
    })
  }

  return (
    <div className="modal-backdrop">
      <section className="teacher-modal group-modal" role="dialog" aria-modal="true" aria-labelledby="group-form-title">
        <header>
          <div><h2 id="group-form-title">{group ? 'Guruhni tahrirlash' : 'Guruh qo‘shish'}</h2><p>Jadval va bog‘lanishlarni kiriting</p></div>
          <button type="button" onClick={close} aria-label="Yopish" disabled={pending}><X size={18} /></button>
        </header>

        {group ? (
          <div style={{ padding: '8px 18px 10px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--surface-soft)' }}>
            <span className={`status-badge ${group.active ? 'status-active' : 'status-finished'}`}>
              {group.active ? 'Faol guruh' : 'Yakunlangan'}
            </span>
          </div>
        ) : null}

        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="group-name-field">Nomi<input name="name" required defaultValue={group?.name} /></label>
            <label>Kurs<select name="course" required value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)} disabled={coursesQuery.isPending || availableCourses.length === 0}>
              <option value="" disabled>{coursesQuery.isPending ? 'Kurslar yuklanmoqda...' : availableCourses.length ? 'Kursni tanlang' : 'Faol kurslar topilmadi'}</option>
              {availableCourses.map((course) => (
                <option key={course.id} value={course.title}>{course.title}{course.active ? '' : ' (Faolsiz)'}</option>
              ))}
            </select></label>
            <label>O‘qituvchi<select name="teacher" required value={selectedTeacher} onChange={(event) => setSelectedTeacher(event.target.value)} disabled={teachersQuery.isPending || availableTeachers.length === 0}>
              <option value="" disabled>{teachersQuery.isPending ? 'O‘qituvchilar yuklanmoqda...' : availableTeachers.length ? 'O‘qituvchini tanlang' : 'Faol o‘qituvchi topilmadi'}</option>
              {availableTeachers.map((teacher) => {
                const fullName = `${teacher.firstName} ${teacher.lastName}`.trim()
                return <option key={teacher.id} value={fullName}>{fullName}{teacher.active ? '' : ' (Faolsiz)'}</option>
              })}
            </select></label>
            <label className="money-input-label">
              Auditoriya
              <input
                name="roomInput"
                type="text"
                inputMode="numeric"
                required
                disabled={pending}
                placeholder="Masalan: 202"
                value={roomRaw}
                onChange={(e) => setRoomRaw(e.target.value)}
                list="rooms-list"
              />
              <datalist id="rooms-list">
                {availableRooms.map((r) => (
                  <option key={r.id} value={r.name.replace(/-xona$/i, '').replace(/^xona\s+/i, '')} />
                ))}
              </datalist>
              {formattedRoom ? <small className="form-field-hint">{formattedRoom}</small> : null}
            </label>
            <label>Vaqt<input name="time" type="time" required defaultValue={group?.time ?? '09:00'} /></label>
            <label>Boshlanish<DateInput name="startDate" defaultValue={group?.startDate} required aria-label="Boshlanish" /></label>
            <label>Davomiyligi (oy)<input name="duration" type="number" min="1" required defaultValue="6" /></label>
            <fieldset className="form-wide weekday-field">
              <legend>Hafta kunlari</legend>

              {weekdays.map((day) => <label key={day}><input type="checkbox" name="weekdays" value={day} defaultChecked={group?.weekdays.includes(day) ?? ['Du', 'Chor', 'Ju'].includes(day)} />{day}</label>)}
            </fieldset>
          </div>
          {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
          <footer>
            <button className="secondary-button" type="button" onClick={close} disabled={pending}>Bekor qilish</button>
            <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Saqlanmoqda...' : 'Saqlash'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

type AddStudentToGroupModalProps = {
  group: Group
  currentStudents: Student[]
  close: () => void
}

function AddStudentToGroupModal({ group, currentStudents, close }: AddStudentToGroupModalProps) {
  const studentsQuery = useStudents()
  const addMutation = useAddGroupStudent()
  const [selectedStudentId, setSelectedStudentId] = useState('')

  const availableStudents = useMemo(() => {
    const raw = studentsQuery.data ?? []
    return raw.filter(
      (s) => s.status === 'active' && !currentStudents.some((cs) => cs.id === s.id),
    )
  }, [studentsQuery.data, currentStudents])

  const studentOptions = useMemo<SelectOption[]>(() => {
    return availableStudents.map((s) => ({
      value: s.id,
      label: `${s.firstName} ${s.lastName} (${s.code})${s.phone ? ` — ${s.phone}` : ''}`,
    }))
  }, [availableStudents])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!selectedStudentId) return
    try {
      await addMutation.mutateAsync({ groupId: group.id, studentId: selectedStudentId })
      close()
    } catch {
      // Handled by mutation error
    }
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <section
        className="teacher-modal add-student-modal"
        style={{ width: 'min(100%, 480px)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-student-title"
      >
        <header>
          <div>
            <h2 id="add-student-title">Guruhga o‘quvchi qo‘shish</h2>
            <p>“{group.name}” guruhiga o‘quvchini biriktirish</p>
          </div>
          <button type="button" onClick={close} aria-label="Yopish" disabled={addMutation.isPending}>
            <X size={18} />
          </button>
        </header>

        <form onSubmit={submit}>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 500 }}>
              O‘quvchini tanlang
              <Select
                id="add-student-select"
                aria-label="O‘quvchini tanlang"
                value={selectedStudentId}
                onChange={setSelectedStudentId}
                options={studentOptions}
                placeholder={
                  studentsQuery.isPending
                    ? 'O‘quvchilar yuklanmoqda...'
                    : availableStudents.length === 0
                    ? 'Mavjud faol o‘quvchilar topilmadi'
                    : 'O‘quvchini tanlang'
                }
                disabled={addMutation.isPending || studentsQuery.isPending || availableStudents.length === 0}
                searchable
              />
            </label>

            {availableStudents.length === 0 && !studentsQuery.isPending ? (
              <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                Barcha faol o‘quvchilar ushbu guruhga qo‘shilgan yoki faol o‘quvchi mavjud emas.
              </small>
            ) : null}

            {addMutation.error ? (
              <p className="form-error" role="alert">
                {formatApiError(addMutation.error, 'O‘quvchini guruhga qo‘shib bo‘lmadi.')}
              </p>
            ) : null}
          </div>

          <footer>
            <button type="button" className="secondary-button" onClick={close} disabled={addMutation.isPending}>
              Bekor qilish
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={!selectedStudentId || addMutation.isPending}
            >
              {addMutation.isPending ? 'Qo‘shilmoqda...' : 'Guruhga qo‘shish'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

type GroupDetailModalProps = {
  group: Group
  close: () => void
  onEdit: () => void
  onTakeAttendance: () => void
}

function GroupDetailModal({ group, close, onEdit, onTakeAttendance }: GroupDetailModalProps) {
  const studentsQuery = useGroupStudents(group.id)
  const removeStudentMutation = useRemoveGroupStudent()
  const [studentSearch, setStudentSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [studentToRemove, setStudentToRemove] = useState<Student | null>(null)

  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.phone.includes(q),
    )
  }, [students, studentSearch])

  async function handleRemove(studentId: string) {
    try {
      await removeStudentMutation.mutateAsync({ groupId: group.id, studentId })
      setStudentToRemove(null)
    } catch {
      // error handled by mutation
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        className="teacher-modal group-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-detail-title"
      >
        <header>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 id="group-detail-title" style={{ margin: 0 }}>{group.name}</h2>
              <span className={`status-badge ${group.active ? 'status-active' : 'status-finished'}`}>
                {group.active ? 'Faol' : 'Yakunlangan'}
              </span>
            </div>
            <p>{group.course} • {group.teacher}</p>
          </div>
          <button type="button" onClick={close} aria-label="Yopish">
            <X size={18} />
          </button>
        </header>

        <div className="group-detail-actions">
          <button
            type="button"
            className="take-attendance-btn"
            onClick={onTakeAttendance}
            title="Guruh uchun davomat olish sahifasiga o‘tish"
          >
            <CalendarCheck size={16} />
            <span>Davomat olish</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="secondary-button"
              style={{ height: 38, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={onEdit}
            >
              <Pencil size={15} />
              <span>Guruhni tahrirlash</span>
            </button>
          </div>
        </div>

        <div className="group-detail-modal-body">
          <div className="group-detail-grid">
            <div className="group-detail-pill">
              <span>Kurs</span>
              <strong title={group.course}>{group.course}</strong>
            </div>
            <div className="group-detail-pill">
              <span>O‘qituvchi</span>
              <strong title={group.teacher}>{group.teacher}</strong>
            </div>
            <div className="group-detail-pill">
              <span>Dars vaqti</span>
              <strong>{group.weekdays.join(', ')} ({group.time})</strong>
            </div>
            <div className="group-detail-pill">
              <span>Auditoriya</span>
              <strong>{group.room}</strong>
            </div>
          </div>

          <div className="group-students-section">
            <div className="group-students-header">
              <div>
                <h3 style={{ margin: 0, fontSize: 14 }}>
                  Guruh o‘quvchilari ({students.length} ta)
                </h3>
              </div>
              {students.length > 0 ? (
                <div className="group-students-toolbar">
                  <div className="group-students-search">
                    <Search size={14} style={{ color: 'var(--muted)' }} />
                    <input
                      type="text"
                      placeholder="Qidirish..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    style={{ height: 34, padding: '0 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    onClick={() => setShowAddModal(true)}
                  >
                    <Plus size={14} />
                    <span>O‘quvchi qo‘shish</span>
                  </button>
                </div>
              ) : null}
            </div>

            {studentsQuery.isPending ? (
              <div className="dashboard-state" style={{ minHeight: 120 }}>O‘quvchilar yuklanmoqda...</div>
            ) : null}

            {studentsQuery.isError ? (
              <div className="dashboard-state dashboard-error" style={{ minHeight: 120 }}>
                O‘quvchilarni yuklab bo‘lmadi
              </div>
            ) : null}

            {!studentsQuery.isPending && !studentsQuery.isError && students.length === 0 ? (
              <div className="empty-state group-empty-card" style={{ padding: '24px 16px' }}>
                <UsersRound size={28} strokeWidth={1.5} style={{ color: 'var(--muted)', marginBottom: 6, opacity: 0.7 }} />
                <p style={{ margin: '0 0 4px 0', color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>
                  Guruhda hali o‘quvchilar yo‘q
                </p>
                <p style={{ margin: '0 0 12px 0', color: 'var(--muted)', fontSize: 11 }}>
                  Guruhga birinchi o‘quvchini biriktirish uchun tugmani bosing
                </p>
                <button
                  type="button"
                  className="primary-button"
                  style={{ height: 34, padding: '0 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus size={14} />
                  <span>O‘quvchi qo‘shish</span>
                </button>
              </div>
            ) : null}

            {!studentsQuery.isPending && !studentsQuery.isError && students.length > 0 && filteredStudents.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 16px' }}>
                Mos o‘quvchilar topilmadi
              </div>
            ) : null}

            {filteredStudents.length > 0 ? (
              <div className="table-scroll" style={{ maxHeight: 320 }}>
                <table className="group-students-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36, textAlign: 'center' }}>№</th>
                      <th>O‘quvchi</th>
                      <th>Telefon</th>
                      <th>Holat</th>
                      <th style={{ width: 100, textAlign: 'center' }}>Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student, idx) => (
                      <tr key={student.id}>
                        <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{idx + 1}</td>
                        <td>
                          <strong>{student.firstName} {student.lastName}</strong>
                          <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>{student.code}</small>
                        </td>
                        <td>{student.phone || '—'}</td>
                        <td>
                          <span className={`status-badge status-${student.status === 'active' ? 'active' : 'finished'}`}>
                            {student.status === 'active' ? 'Faol' : student.status === 'frozen' ? 'Muzlatilgan' : 'Bitirgan'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="student-remove-btn"
                            title="Guruhdan chiqarish"
                            aria-label={`${student.firstName}ni guruhdan chiqarish`}
                            onClick={() => setStudentToRemove(student)}
                            disabled={removeStudentMutation.isPending}
                          >
                            <UserMinus size={13} />
                            <span>Chiqarish</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>

        <footer>
          <button type="button" className="secondary-button" onClick={close}>
            Yopish
          </button>
        </footer>
      </section>

      {studentToRemove ? (
        <ConfirmDialog
          title="O‘quvchini guruhdan chiqarish"
          description={`Haqiqatan ham “${studentToRemove.firstName} ${studentToRemove.lastName}” o‘quvchisini “${group.name}” guruhidan chiqarmoqchimisiz?`}
          confirmLabel="Guruhdan chiqarish"
          cancelLabel="Bekor qilish"
          variant="danger"
          pending={removeStudentMutation.isPending}
          errorMessage={removeStudentMutation.error ? formatApiError(removeStudentMutation.error, 'O‘quvchini guruhdan chiqarib bo‘lmadi.') : null}
          onCancel={() => {
            setStudentToRemove(null)
            removeStudentMutation.reset()
          }}
          onConfirm={() => void handleRemove(studentToRemove.id)}
        />
      ) : null}

      {showAddModal ? (
        <AddStudentToGroupModal
          group={group}
          currentStudents={students}
          close={() => setShowAddModal(false)}
        />
      ) : null}
    </div>
  )
}

export function GroupsPage() {
  const navigate = useNavigate()
  const query = useGroups()
  const saveMutation = useSaveGroup()
  const activeMutation = useSetGroupActive()
  const [searchParams, setSearchParams] = useSearchParams()
  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [editing, setEditing] = useState<Group | 'new' | null>(() => searchParams.get('action') === 'new' ? 'new' : null)
  const [selectedGroupForDetail, setSelectedGroupForDetail] = useState<Group | null>(null)
  const [pendingStatus, setPendingStatus] = useState<Group | null>(null)
  const [connectingTelegramGroup, setConnectingTelegramGroup] = useState<Group | null>(null)

  const handleSearchChange = (val: string) => { setSearch(val); setPage(1) }
  const handleStatusChange = (val: string) => { setStatus(val); setPage(1) }

  const groups = query.data ?? emptyGroups

  const filtered = useMemo(
    () => groups.filter((group) => group.name.toLowerCase().includes(search.toLowerCase()) && (status === 'all' || String(group.active) === String(status === 'active'))),
    [groups, search, status],
  )

  const paginatedGroups = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  async function save(group: Group) {
    try {
      await saveMutation.mutateAsync(group)
      closeForm()
    } catch {
      // Mutation state renders the recoverable error.
    }
  }

  async function changeStatus(group: Group) {
    try {
      await activeMutation.mutateAsync({ id: group.id, active: !group.active })
      setPendingStatus(null)
    } catch {
      // Mutation state renders the recoverable error.
    }
  }

  function requestStatusChange(group: Group) {
    if (group.active) {
      setPendingStatus(group)
      return
    }
    void changeStatus(group)
  }

  function closeForm() {
    setEditing(null)
    if (searchParams.get('action') === 'new') setSearchParams({}, { replace: true })
  }

  function openFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, group: Group) {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    setSelectedGroupForDetail(group)
  }

  return (
    <section className="groups-page">
      <div className="page-heading">
        <div><h1>Guruhlar</h1><p>Guruhlar, jadval va o‘quvchilarni boshqarish</p></div>
        <button type="button" aria-label="Guruh qo‘shish" onClick={() => setEditing('new')}><Plus size={16} /> <span>Guruh qo‘shish</span></button>
      </div>
      <div className="course-toolbar">
        <label className="search-field"><Search size={16} /><input aria-label="Guruh qidirish" value={search} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Guruh nomi" /></label>
        <select aria-label="Guruh holati" value={status} onChange={(event) => handleStatusChange(event.target.value)}>
          <option value="active">Faol</option><option value="inactive">Yakunlangan</option><option value="all">Barchasi</option>
        </select>
      </div>

      {query.isPending ? <div className="dashboard-state">Guruhlar yuklanmoqda...</div> : null}
      {query.isError ? <div className="dashboard-state dashboard-error" role="alert">Guruhlarni yuklab bo‘lmadi</div> : null}
      {activeMutation.isError ? <div className="dashboard-state dashboard-error" role="alert">Guruh holatini o‘zgartirib bo‘lmadi</div> : null}
      {!query.isPending && !query.isError && filtered.length === 0 ? <div className="empty-state">Mos guruhlar topilmadi</div> : null}

      {filtered.length > 0 ? <div className="groups-table panel">
        <div className="table-scroll">
          <table aria-label="Guruhlar ro‘yxati">
            <thead><tr><th>Guruh</th><th>Kurs / O‘qituvchi</th><th>Jadval</th><th>Auditoriya</th><th>O‘quvchilar</th><th>Telegram</th><th>Muddat</th><th /></tr></thead>
            <tbody>
              {paginatedGroups.map((group) => (
                <tr
                  key={group.id}
                  tabIndex={0}
                  aria-label={`${group.name} guruhi`}
                  onClick={() => setSelectedGroupForDetail(group)}
                  onKeyDown={(event) => openFromKeyboard(event, group)}
                >
                  <td data-label="Guruh"><strong>{group.name}</strong><small className={`status-badge ${group.active ? 'status-active' : 'status-finished'}`}>{group.active ? 'Faol' : 'Yakunlangan'}</small></td>
                  <td data-label="Kurs / O‘qituvchi">{group.course}<small>{group.teacher}</small></td>
                  <td data-label="Jadval"><span><CalendarDays size={13} />{group.weekdays.join(', ')}</span><small><Clock3 size={12} />{group.time}</small></td>
                  <td data-label="Auditoriya"><span><MapPin size={13} />{group.room}</span></td>
                  <td data-label="O‘quvchilar"><span><UsersRound size={13} />{group.activeStudents} faol</span><small>{group.graduateStudents} bitirgan</small></td>
                  <td data-label="Telegram" onClick={(e) => e.stopPropagation()}>
                    {group.telegramChatId ? (
                      <button
                        type="button"
                        translate="no"
                        className="notranslate"
                        onClick={() => setConnectingTelegramGroup(group)}
                        title="Telegram sozlamalarini ko‘rish"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 8px',
                          borderRadius: 12,
                          fontSize: 12,
                          background: '#e0f2fe',
                          color: '#0284c7',
                          border: '1px solid #bae6fd',
                          cursor: 'pointer',
                          fontWeight: 500,
                          maxWidth: 130,
                        }}
                      >
                        <Send size={11} />
                        <span translate="no" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {group.telegramChatTitle || 'Bog‘langan'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        translate="no"
                        className="notranslate"
                        onClick={() => setConnectingTelegramGroup(group)}
                        title="Telegram guruhni ulash"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 12,
                          fontSize: 11,
                          background: 'rgba(0,0,0,0.03)',
                          color: 'var(--muted)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                      >
                        <Send size={11} />
                        <span translate="no">Ulash</span>
                      </button>
                    )}
                  </td>
                  <td data-label="Muddat">{formatDate(group.startDate)}<small>{formatDate(group.endDate)}</small></td>


                  <td data-label="Amallar">
                    <div className="group-actions" style={{ gap: 6 }}>
                      <button
                        type="button"
                        className="group-status-button"
                        aria-label={`${group.name} o‘quvchilar ro‘yxati`}
                        title="O‘quvchilar ro‘yxatini ko‘rish"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedGroupForDetail(group)
                        }}
                      >
                        O‘quvchilar
                      </button>
                      <button
                        type="button"
                        className="group-status-button"
                        aria-label={`${group.name} guruhiga davomat olish`}
                        title="Davomat olish"
                        style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
                        onClick={(event) => {
                          event.stopPropagation()
                          const todayIso = new Date().toLocaleDateString('en-CA')
                          navigate(`/attendance?group=${group.id}&date=${todayIso}&view=daily`)
                        }}
                      >
                        Davomat
                      </button>
                      <button
                        type="button"
                        className="group-status-button"
                        aria-label={`${group.name} guruhini tahrirlash`}
                        title="Tahrirlash"
                        onClick={(event) => {
                          event.stopPropagation()
                          setEditing(group)
                        }}
                      >
                        Tahrirlash
                      </button>
                      <button
                        type="button"
                        className="group-status-button"
                        aria-label={`${group.name} guruhini ${group.active ? 'yakunlash' : 'faollashtirish'}`}
                        disabled={activeMutation.isPending}
                        onClick={(event) => { event.stopPropagation(); requestStatusChange(group) }}
                      >
                        {group.active ? 'Yakunlash' : 'Faollashtirish'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div> : null}

      {selectedGroupForDetail ? (
        <GroupDetailModal
          group={query.data?.find((g) => g.id === selectedGroupForDetail.id) ?? selectedGroupForDetail}
          close={() => setSelectedGroupForDetail(null)}
          onEdit={() => {
            const grp = selectedGroupForDetail
            setSelectedGroupForDetail(null)
            setEditing(grp)
          }}
          onTakeAttendance={() => {
            const todayIso = new Date().toLocaleDateString('en-CA')
            navigate(`/attendance?group=${selectedGroupForDetail.id}&date=${todayIso}&view=daily`)
          }}
        />
      ) : null}

      {editing ? (
        <GroupForm
          group={editing === 'new' ? undefined : editing}
          pending={saveMutation.isPending}
          errorMessage={saveMutation.error ? formatApiError(saveMutation.error, 'Guruhni saqlab bo‘lmadi. Qayta urinib ko‘ring.') : null}
          close={closeForm}
          save={(group) => void save(group)}
        />
      ) : null}
      {pendingStatus ? (
        <ConfirmDialog
          title="Guruhni yakunlash"
          description={`“${pendingStatus.name}” guruhi yakunlangan holatiga o‘tadi.`}
          confirmLabel="Yakunlash"
          pending={activeMutation.isPending}
          errorMessage={activeMutation.error ? formatApiError(activeMutation.error, 'Guruh holatini o‘zgartirib bo‘lmadi.') : null}
          onCancel={() => {
            setPendingStatus(null)
            activeMutation.reset()
          }}
          onConfirm={() => void changeStatus(pendingStatus)}
        />
      ) : null}
      {connectingTelegramGroup ? (
        <TelegramGroupConnectModal
          group={query.data?.find((g) => g.id === connectingTelegramGroup.id) ?? connectingTelegramGroup}
          onClose={() => setConnectingTelegramGroup(null)}
        />
      ) : null}
    </section>
  )
}
