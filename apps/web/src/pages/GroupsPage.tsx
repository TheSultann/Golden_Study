import type { Group } from '@golden-study/contracts'
import { CalendarDays, Clock3, MapPin, Plus, Search, Send, UsersRound, X } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCourses } from '../features/courses/useCourses'
import { useGroups, useSaveGroup, useSetGroupActive } from '../features/groups/useGroups'
import { TelegramGroupConnectModal } from '../features/groups/TelegramGroupConnectModal'
import { useRooms } from '../features/rooms/useRooms'
import { useTeachers } from '../features/teachers/useTeachers'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { DateInput, displayToIsoDate } from '../shared/ui/DateInput'
import { Pagination } from '../shared/ui/Pagination'
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

export function GroupsPage() {
  const query = useGroups()
  const saveMutation = useSaveGroup()
  const activeMutation = useSetGroupActive()
  const [searchParams, setSearchParams] = useSearchParams()
  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [editing, setEditing] = useState<Group | 'new' | null>(() => searchParams.get('action') === 'new' ? 'new' : null)
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
    setEditing(group)
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
                  aria-label={`${group.name} guruhini tahrirlash`}
                  onClick={() => setEditing(group)}
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
                    <div className="group-actions">
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
