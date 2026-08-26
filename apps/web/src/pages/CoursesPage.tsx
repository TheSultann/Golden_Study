import type { Course } from '@golden-study/contracts'
import { AlertCircle, BookOpen, Clock3, Pencil, Plus, Search, Trash2, UsersRound, X } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'

import { useCourses, useSaveCourse, useSetCourseActive } from '../features/courses/useCourses'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'

const money = new Intl.NumberFormat('uz-UZ')
const emptyCourses: Course[] = []

type CourseFormProps = {
  course?: Course
  pending: boolean
  error: boolean
  close: () => void
  save: (course: Course) => void
}

function CourseForm({ course, pending, error, close, save }: CourseFormProps) {
  const [priceRaw, setPriceRaw] = useState<string>(() => course ? String(course.pricePerMonth) : '500000')

  const numericPrice = Number(priceRaw.replaceAll(/\D/g, '')) || 0
  const displayPrice = numericPrice > 0 ? money.format(numericPrice) : priceRaw
  const priceHint = numericPrice > 0 ? `${money.format(numericPrice)} so‘m` : null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    save({
      id: course?.id ?? `new-${Date.now()}`,
      title: String(data.get('title')).trim(),
      description: String(data.get('description')).trim(),
      durationMonths: Number(data.get('duration')),
      pricePerMonth: numericPrice,
      groupsCount: course?.groupsCount ?? 0,
      studentsCount: course?.studentsCount ?? 0,
      active: course?.active ?? true,
    })
  }

  return (
    <div className="modal-backdrop">
      <section className="teacher-modal" role="dialog" aria-modal="true" aria-labelledby="course-form-title">
        <header>
          <div>
            <h2 id="course-form-title">{course ? 'Kursni tahrirlash' : 'Kurs qo‘shish'}</h2>
            <p>Kurs ma’lumotlarini kiriting</p>
          </div>
          <button type="button" onClick={close} aria-label="Yopish" disabled={pending}><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="form-wide">Nomi<input name="title" required defaultValue={course?.title} /></label>
            <label className="form-wide">Tavsif<textarea name="description" placeholder="Kurs haqida qo‘shimcha ma’lumot (ixtiyoriy)" defaultValue={course?.description} /></label>
            <label>Davomiyligi (oy)<input name="duration" type="number" min="1" required defaultValue={course?.durationMonths ?? 6} /></label>
            <label>
              Oylik narxi (UZS)
              <input
                name="priceInput"
                type="text"
                inputMode="numeric"
                required
                disabled={pending}
                placeholder="600 000"
                value={displayPrice}
                onChange={(e) => {
                  const raw = e.target.value.replaceAll(/\D/g, '')
                  setPriceRaw(raw)
                }}
              />
              {priceHint ? <small className="form-field-hint">{priceHint}</small> : null}
            </label>
          </div>
          {error ? <p className="form-error" role="alert">Kursni saqlab bo‘lmadi. Qayta urinib ko‘ring.</p> : null}
          <footer>
            <button type="button" className="secondary-button" onClick={close} disabled={pending}>Bekor qilish</button>
            <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Saqlanmoqda...' : 'Saqlash'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function CoursesPage() {
  const query = useCourses()
  const saveMutation = useSaveCourse()
  const activeMutation = useSetCourseActive()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Course | 'new' | null>(null)
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null)
  const courses = query.data ?? emptyCourses
  const filtered = useMemo(
    () => courses.filter((course) => course.active && course.title.toLowerCase().includes(search.toLowerCase())),
    [courses, search],
  )

  async function save(course: Course) {
    try {
      await saveMutation.mutateAsync(course)
      setEditing(null)
    } catch {
      // Mutation state renders the recoverable error.
    }
  }

  async function deleteCourse(course: Course) {
    try {
      await activeMutation.mutateAsync({ id: course.id, active: false })
      setDeletingCourse(null)
    } catch {
      // Mutation state renders the recoverable error.
    }
  }

  return (
    <section className="courses-page">
      <div className="page-heading">
        <div><h1>Kurslar</h1><p>Kurslar, davomiylik va oylik narxlarni boshqarish</p></div>
        <button type="button" aria-label="Kurs qo‘shish" onClick={() => setEditing('new')}><Plus size={16} /> <span>Kurs qo‘shish</span></button>
      </div>
      <div className="course-toolbar">
        <label className="search-field"><Search size={16} /><input aria-label="Kurs qidirish" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kurs nomini qidirish" /></label>
      </div>

      {query.isPending ? <div className="dashboard-state">Kurslar yuklanmoqda...</div> : null}
      {query.isError ? <div className="dashboard-state dashboard-error" role="alert">Kurslarni yuklab bo‘lmadi</div> : null}
      {activeMutation.isError ? (
        <div className="course-alert-banner" role="alert">
          <AlertCircle size={16} />
          <span>
            {activeMutation.error instanceof Error && activeMutation.error.message.includes('active groups')
              ? 'Faol guruhlari mavjud kursni o‘chirib bo‘lmaydi. Avval guruhlarni yakunlang.'
              : activeMutation.error instanceof Error
              ? activeMutation.error.message
              : 'Faol guruhlari mavjud kursni o‘chirib bo‘lmaydi'}
          </span>
        </div>
      ) : null}
      {!query.isPending && !query.isError && filtered.length === 0 ? <div className="empty-state">Mos kurslar topilmadi</div> : null}

      <div className="course-grid">
        {filtered.map((course) => (
          <article className="course-card" key={course.id}>
            <button className="course-card-hitarea" type="button" aria-label={`${course.title} kursini tahrirlash`} onClick={() => setEditing(course)} />
            <header>
              <span><BookOpen size={19} /></span>
              <div className="course-card-actions">
                <button
                  className="course-action-btn course-action-edit"
                  type="button"
                  onClick={() => setEditing(course)}
                  aria-label={`${course.title} kursini tahrirlash menyusi`}
                  title="Tahrirlash"
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="course-action-btn course-action-delete"
                  type="button"
                  onClick={() => setDeletingCourse(course)}
                  aria-label={`${course.title} kursini o‘chirish`}
                  title="O‘chirish"
                  disabled={activeMutation.isPending}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </header>
            <div><h2>{course.title}</h2><p>{course.description}</p></div>
            <dl>
              <div><dt><Clock3 size={14} /> Davomiyligi</dt><dd>{course.durationMonths} oy</dd></div>
              <div><dt><UsersRound size={14} /> Guruhlar</dt><dd>{course.groupsCount} ta · {course.studentsCount} o‘quvchi</dd></div>
            </dl>
            <footer>
              <div><small>Oylik narxi</small><strong>{money.format(course.pricePerMonth)} so‘m</strong></div>
            </footer>
          </article>
        ))}
      </div>

      {editing ? <CourseForm course={editing === 'new' ? undefined : editing} pending={saveMutation.isPending} error={saveMutation.isError} close={() => setEditing(null)} save={(course) => void save(course)} /> : null}
      {deletingCourse ? (
        <ConfirmDialog
          title="Kursni o‘chirish"
          description={`“${deletingCourse.title}” kursi o‘chiriladi va ro‘yxatdan olib tashlanadi.`}
          confirmLabel="O‘chirish"
          pending={activeMutation.isPending}
          onCancel={() => setDeletingCourse(null)}
          onConfirm={() => void deleteCourse(deletingCourse)}
        />
      ) : null}
    </section>
  )
}
