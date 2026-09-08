import { Edit3, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { getSession } from '../auth/auth.service'
import { useStudentProfile } from './useStudentProfile'

type StudentProfileDrawerProps = {
  studentId: string
  onClose: () => void
  onEdit: (studentId: string) => void
}

const statusLabels = {
  active: 'Faol',
  frozen: 'Muzlatilgan',
  graduate: 'Bitirgan',
} as const

const money = new Intl.NumberFormat('uz-UZ')

export function StudentProfileDrawer({ studentId, onClose, onEdit }: StudentProfileDrawerProps) {
  const profileQuery = useStudentProfile(studentId)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const user = getSession()
  const isTeacher = user?.role === 'teacher'
  const profile = profileQuery.data
  const summary = profile?.academicSummary
  const hasAcademicData = summary ? Object.values(summary).some((value) => value !== null) : false
  const title = profile ? `${profile.student.firstName} ${profile.student.lastName}` : 'O‘quvchi kartasi'

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', closeOnEscape)
      previousFocus?.focus()
    }
  }, [onClose])

  return (
    <>
      <button className="student-profile-backdrop" type="button" aria-label="O‘quvchi kartasini yopish" onClick={onClose} />
      <aside className="student-profile-drawer" role="dialog" aria-modal="true" aria-labelledby="student-profile-title">
        <header>
          <div>
            <h2 id="student-profile-title">{title}</h2>
            {profile ? <p>{profile.student.code}</p> : null}
          </div>
          <button ref={closeButtonRef} type="button" aria-label="Yopish" onClick={onClose}><X size={18} /></button>
        </header>

        {profileQuery.isPending ? <div className="student-profile-state">O‘quvchi ma’lumotlari yuklanmoqda...</div> : null}

        {profileQuery.isError ? (
          <div className="student-profile-state student-profile-error" role="alert">
            <span>O‘quvchi kartasini yuklab bo‘lmadi</span>
            <button type="button" className="secondary-button" onClick={() => void profileQuery.refetch()}><RotateCcw size={14} /> Qayta urinish</button>
          </div>
        ) : null}

        {profile ? (
          <>
            <div className="student-profile-body">
              <section aria-labelledby="academic-summary-title">
                <div className="student-profile-headline">
                  <div className="student-profile-title-badges">
                    <h3 id="academic-summary-title">O‘qish ko‘rsatkichlari</h3>
                    <span className={`student-status student-status--${profile.student.status}`}>{statusLabels[profile.student.status]}</span>
                  </div>
                  {profile.student.groups.length > 0 ? (
                    <div className="student-profile-groups">
                      {profile.student.groups.map((group) => <span key={group}>{group}</span>)}
                    </div>
                  ) : null}
                </div>
                {hasAcademicData ? (
                  <div className="student-profile-metrics">
                    <Metric label="Umumiy reyting" value={summary?.ratingScore === null ? '—' : `${summary?.ratingScore}/100`} />
                    <Metric label="Guruhdagi o‘rni" value={summary?.groupPlace === null ? '—' : `#${summary?.groupPlace}`} />
                    <Metric label="Imtihonlar" value={summary?.examAveragePercent === null ? '—' : `${summary?.examAveragePercent}%`} />
                    <Metric label="Davomat" value={summary?.attendancePercent === null ? '—' : `${summary?.attendancePercent}%`} />
                    <Metric label="Uy vazifasi" value={summary?.homeworkPercent === null ? '—' : `${summary?.homeworkPercent}%`} />
                  </div>
                ) : <p className="student-profile-empty">Ma’lumot yetarli emas</p>}
              </section>

              <section aria-labelledby="student-finance-title">
                <h3 id="student-finance-title">Moliya</h3>
                <div className={`student-profile-balance ${profile.student.balance < 0 ? 'debt' : 'credit'}`}>
                  <span>Balans</span>
                  <strong>{money.format(profile.student.balance)} UZS</strong>
                </div>
              </section>

              <section aria-labelledby="student-contacts-title">
                <h3 id="student-contacts-title">Aloqa ma’lumotlari</h3>
                <dl className="student-profile-details">
                  <div><dt>Telefon</dt><dd>{profile.student.phone}</dd></div>
                  <div><dt>Ota-ona</dt><dd>{profile.student.parentName}</dd></div>
                  <div><dt>Ota-ona telefoni</dt><dd>{profile.student.parentPhone}</dd></div>
                  <div><dt>Manzil</dt><dd>{profile.student.address}</dd></div>
                </dl>
              </section>
            </div>

            <footer>
              <button type="button" className="secondary-button" onClick={onClose}>Yopish</button>
              {!isTeacher && (
                <button type="button" className="secondary-button" onClick={() => { onClose(); window.location.href = `/finance?studentId=${studentId}`; }}><Plus size={15} /> To‘lov</button>
              )}
              <button type="button" className="primary-button" onClick={() => onEdit(studentId)}><Edit3 size={15} /> Tahrirlash</button>
            </footer>
          </>
        ) : null}
      </aside>
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article><span>{label}</span><strong>{value}</strong></article>
}
