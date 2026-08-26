import type { Lead, LeadStatus } from '@golden-study/contracts'
import { Pencil, Phone, Plus, Search, Trash2, User, X } from 'lucide-react'

import { type FormEvent, useMemo, useState } from 'react'
import { useCourses } from '../features/courses/useCourses'
import { useArchiveLead, useLeads, useMoveLead, useSaveLead } from '../features/leads/useLeads'
import { useTeachers } from '../features/teachers/useTeachers'
import { formatApiError } from '../shared/api/errorTranslation'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { PhoneInput, formatDisplayPhone, normalizePhoneWithPrefix } from '../shared/ui/PhoneInput'

const columns: [LeadStatus, string][] = [
  ['new', 'Yangi'],
  ['contacted', 'Aloqa'],
  ['callback', 'Qayta qo‘ng‘iroq'],
  ['trial', 'Sinov darsi'],
  ['converted', 'Ro‘yxatdan o‘tgan'],
]
const empty: Lead[] = []

function getCourseTitle(course: { id: string; title?: string | null }): string {
  if (!course.title || course.title === 'null' || course.title.trim() === '') {
    return `Nomsiz kurs (#${course.id.slice(0, 6)})`
  }
  return course.title
}

function getTeacherName(teacher: { id: string; firstName?: string | null; lastName?: string | null }): string {
  const name = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim()
  if (!name || name === 'null') {
    return `O‘qituvchi (#${teacher.id.slice(0, 6)})`
  }
  return name
}

function LeadForm({
  initialValue,
  close,
  save,
  onDelete,
}: {
  initialValue?: Lead | null
  close: () => void
  save: (value: Lead) => Promise<void>
  onDelete?: () => void
}) {
  const { data: courses = [] } = useCourses()
  const { data: teachers = [] } = useTeachers()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const isEdit = Boolean(initialValue)
  const isConverted = initialValue?.status === 'converted'

  const selectedCourseId = useMemo(() => {
    if (!initialValue?.course) return ''
    const found = courses.find(
      (c) => c.id === initialValue.course || c.title === initialValue.course,
    )
    return found ? found.id : initialValue.course
  }, [courses, initialValue])

  const selectedTeacherId = useMemo(() => {
    if (!initialValue?.teacher) return ''
    const found = teachers.find(
      (t) =>
        t.id === initialValue.teacher ||
        `${t.firstName} ${t.lastName}`.trim() === initialValue.teacher ||
        t.firstName === initialValue.teacher,
    )
    return found ? found.id : initialValue.teacher
  }, [teachers, initialValue])

  const availableCourses = useMemo(() => {
    const list = courses.filter((c) => c.active !== false)
    if (selectedCourseId && !list.some((c) => c.id === selectedCourseId)) {
      const extra = courses.find((c) => c.id === selectedCourseId)
      if (extra) list.push(extra)
    }
    return list
  }, [courses, selectedCourseId])

  const availableTeachers = useMemo(() => {
    const list = teachers.filter((t) => t.active !== false)
    if (selectedTeacherId && !list.some((t) => t.id === selectedTeacherId)) {
      const extra = teachers.find((t) => t.id === selectedTeacherId)
      if (extra) list.push(extra)
    }
    return list
  }, [teachers, selectedTeacherId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const data = new FormData(event.currentTarget)
      const phone = normalizePhoneWithPrefix(data.get('phone'))
      const digits = phone.replace(/\D/g, '')

      if (digits.length < 12) {
        setError('Telefon raqami 9 ta raqamdan iborat bo‘lishi kerak')
        setSubmitting(false)
        return
      }

      await save({
        id: initialValue?.id ?? `new-${Date.now()}`,
        fullName: String(data.get('name')),
        phone,
        course: String(data.get('course') || ''),
        teacher: String(data.get('teacher') || ''),
        status: String(data.get('status')) as LeadStatus,
        comment: String(data.get('comment')),
        createdAt: initialValue?.createdAt ?? new Date().toISOString().slice(0, 10),
      })
    } catch (err: unknown) {
      setError(formatApiError(err, 'Saqlashda xatolik yuz berdi'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="teacher-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>{isEdit ? 'Lidni tahrirlash' : 'Lid qo‘shish'}</h2>
            <p>Aloqa va qiziqish ma’lumotlari</p>
          </div>
          <button onClick={close} aria-label="Yopish" disabled={submitting}>
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit}>
          {error ? <div className="form-error" style={{ color: '#ef4444', marginBottom: '12px', fontSize: '13px' }}>{error}</div> : null}
          <div className="form-grid">
            <label className="form-wide">
              Ism va familiya
              <input name="name" defaultValue={initialValue?.fullName ?? ''} required disabled={submitting} />
            </label>
            <label>
              Telefon
              <PhoneInput name="phone" defaultValue={initialValue?.phone ?? ''} required disabled={submitting} />
            </label>
            <label>
              Kurs
              <select name="course" defaultValue={selectedCourseId} aria-label="Kurs" disabled={submitting}>
                <option value="">Tanlanmagan</option>
                {availableCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {getCourseTitle(course)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              O‘qituvchi
              <select name="teacher" defaultValue={selectedTeacherId} aria-label="O‘qituvchi" disabled={submitting}>
                <option value="">Tanlanmagan</option>
                {availableTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {getTeacherName(teacher)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Boshlang‘ich holat
              <select name="status" defaultValue={initialValue?.status ?? 'new'} aria-label="Boshlang‘ich holat" disabled={submitting || isConverted}>
                {columns.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-wide">
              Izoh
              <textarea name="comment" defaultValue={initialValue?.comment ?? ''} disabled={submitting} />
            </label>
          </div>
          <footer>
            {isEdit && onDelete ? (
              <button
                type="button"
                className="secondary-button"
                style={{ color: '#ef4444', borderColor: '#fca5a5', marginRight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                onClick={onDelete}
                disabled={submitting}
              >
                <Trash2 size={14} /> O‘chirish
              </button>
            ) : null}
            <button type="button" className="secondary-button" onClick={close} disabled={submitting}>
              Bekor
            </button>
            <button className="primary-button" disabled={submitting}>
              {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function LeadsPage() {
  const query = useLeads()
  const move = useMoveLead()
  const saveMutation = useSaveLead()
  const archiveMutation = useArchiveLead()
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [dragged, setDragged] = useState<string | null>(null)
  const data = query.data ?? empty
  const filtered = useMemo(
    () => data.filter((item) => item.fullName.toLowerCase().includes(search.toLowerCase())),
    [data, search],
  )
  async function save(value: Lead) {
    await saveMutation.mutateAsync(value)
    setAdding(false)
    setEditingLead(null)
  }
  function changeStatus(id: string, status: LeadStatus) {
    setActionError(null)
    move.mutate(
      { id, status },
      {
        onError: (err) => {
          setActionError(formatApiError(err, 'Statusni o‘zgartirib bo‘lmadi'))
        },
      },
    )
  }

  return (
    <section className="leads-page">
      <div className="page-heading">
        <div>
          <h1>Lidlar</h1>
          <p>Murojaatlardan ro‘yxatdan o‘tishgacha</p>
        </div>
        <button onClick={() => setAdding(true)}>
          <Plus size={16} /> Lid qo‘shish
        </button>
      </div>
      {actionError ? (
        <div className="form-error" style={{ color: '#ef4444', background: '#fee2e2', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
          {actionError}
        </div>
      ) : null}
      <label className="search-field lead-search">
        <Search size={16} />
        <input
          aria-label="Lid qidirish"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ism bo‘yicha qidirish"
        />
      </label>
      {query.isPending ? <div className="dashboard-state">Lidlar yuklanmoqda...</div> : null}
      <div className="lead-board">
        {columns.map(([status, label]) => (
          <section
            className="lead-column"
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragged) changeStatus(dragged, status)
              setDragged(null)
            }}
          >
            <header>
              <h2>{label}</h2>
              <span>{filtered.filter((item) => item.status === status).length}</span>
            </header>
            <div>
              {filtered
                .filter((item) => item.status === status)
                .map((lead) => (
                  <article
                    className={`lead-card ${dragged === lead.id ? 'dragging' : ''}`}
                    key={lead.id}
                    draggable={lead.status !== 'converted'}
                    onDragStart={() => setDragged(lead.id)}
                    onDragEnd={() => setDragged(null)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                      <h3 style={{ margin: 0 }}>{lead.fullName}</h3>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          style={{ background: 'transparent', border: 0, padding: '2px', cursor: 'pointer', color: 'var(--muted)' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingLead(lead)
                          }}
                          aria-label={`${lead.fullName} ma’lumotlarini tahrirlash`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          style={{ background: 'transparent', border: 0, padding: '2px', cursor: 'pointer', color: '#ef4444' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingLeadId(lead.id)
                          }}
                          aria-label={`${lead.fullName} lidini o‘chirish`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <p>
                      <Phone size={12} />
                      {formatDisplayPhone(lead.phone)}
                    </p>

                    {lead.course ? <strong>{lead.course}</strong> : null}
                    {lead.teacher ? (
                      <small style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', margin: '2px 0' }}>
                        <User size={11} /> {lead.teacher}
                      </small>
                    ) : null}
                    {lead.comment ? <small>{lead.comment}</small> : null}

                    <select
                      aria-label={`${lead.fullName} holati`}
                      value={lead.status}
                      disabled={lead.status === 'converted'}
                      onChange={(event) =>
                        changeStatus(lead.id, event.target.value as LeadStatus)
                      }
                    >
                      {columns.map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
      {adding ? <LeadForm close={() => setAdding(false)} save={save} /> : null}
      {editingLead ? (
        <LeadForm
          initialValue={editingLead}
          close={() => setEditingLead(null)}
          save={save}
          onDelete={() => setDeletingLeadId(editingLead.id)}
        />
      ) : null}
      {deletingLeadId ? (
        <ConfirmDialog
          title="Lidni o‘chirish"
          description="Ushbu lidni o‘chirishga ishonchingiz komilmi? Ushbu harakatni bekor qilib bo‘lmaydi."
          confirmLabel="O‘chirish"
          pending={archiveMutation.isPending}
          onConfirm={async () => {
            try {
              await archiveMutation.mutateAsync(deletingLeadId)
              setDeletingLeadId(null)
              setEditingLead(null)
            } catch (err: unknown) {
              setActionError(formatApiError(err, 'Lidni o‘chirib bo‘lmadi'))
            }
          }}
          onCancel={() => setDeletingLeadId(null)}
        />
      ) : null}
    </section>
  )
}
