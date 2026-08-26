import type { Exam, TeacherExamGroup } from '@golden-study/contracts'
import { BarChart3, CalendarDays, CheckCircle2, Plus, Save, Search, Trash2, Trophy, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useDeleteTeacherExam, useSaveTeacherExam, useTeacherExamGroups, useTeacherExams } from '../features/teacher-exams/useTeacherExams'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { DateInput, displayToIsoDate } from '../shared/ui/DateInput'

const empty: Exam[] = []
const formatter = new Intl.NumberFormat('uz-UZ')
const formatDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}.${month}.${year}`
}

function stats(exam: Exam) {
  const scores = exam.results.map((result) => result.score)
  const sum = scores.reduce((acc, score) => acc + score, 0)
  return {
    average: scores.length ? Math.round(sum / scores.length) : 0,
    max: scores.length ? Math.max(...scores) : 0,
    min: scores.length ? Math.min(...scores) : 0,
  }
}

function sortByRank(exam: Exam) {
  return [...exam.results].sort((a, b) => a.rank - b.rank)
}

export function TeacherExamsPage() {
  const query = useTeacherExams()
  const groupsQuery = useTeacherExamGroups()
  const save = useSaveTeacherExam()
  const deleteMutation = useDeleteTeacherExam()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Exam | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'success' | 'error'>('idle')
  const [pendingExamId, setPendingExamId] = useState<string | null>(null)
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null)
  const [showDeletedToast, setShowDeletedToast] = useState(false)
  const exams = query.data ?? empty
  const examBeingDeleted = useMemo(() => exams.find((e) => e.id === deletingExamId), [exams, deletingExamId])
  const filledResultsCount = useMemo(() => {
    if (!examBeingDeleted) return 0
    return examBeingDeleted.results.filter((r) => r.score > 0).length
  }, [examBeingDeleted])
  const filtered = useMemo(() => exams.filter((exam) => `${exam.name} ${exam.groupName}`.toLowerCase().includes(search.toLowerCase())), [exams, search])
  const selected = exams.find((exam) => exam.id === selectedId) ?? filtered[0] ?? null
  const activeExam = useMemo(() => {
    if (!selected) return null
    return draft?.id === selected.id ? draft : selected
  }, [draft, selected])
  const selectedStats = activeExam ? stats(activeExam) : null
  const isDirty = Boolean(draft && selected && draft.id === selected.id && JSON.stringify(draft.results) !== JSON.stringify(selected.results))

  useEffect(() => {
    setDraft(selected ? structuredClone(selected) : null)
    setSaveFeedback('idle')
  }, [selected])

  function updateScore(studentId: string, score: number) {
    setSaveFeedback('idle')
    setDraft((current) => {
      if (!current) return current
      const nextScore = Math.max(0, Math.min(current.maxScore, score || 0))
      const updatedResults = current.results.map((result) =>
        result.studentId === studentId ? { ...result, score: nextScore } : result
      )
      
      const sorted = [...updatedResults].sort((a, b) => b.score - a.score)
      const rankedResults = updatedResults.map((result) => {
        const rankIndex = sorted.findIndex((s) => s.studentId === result.studentId)
        return { ...result, rank: rankIndex + 1 }
      })

      return { ...current, results: rankedResults }
    })
  }

  function updateComment(studentId: string, comment: string) {
    setSaveFeedback('idle')
    setDraft((current) => current ? { ...current, results: current.results.map((result) => result.studentId === studentId ? { ...result, comment } : result) } : current)
  }

  function requestExamChange(examId: string) {
    if (examId === selected?.id) return
    if (isDirty) {
      setPendingExamId(examId)
      return
    }
    setSelectedId(examId)
  }

  async function createExam(exam: Exam) {
    const saved = await save.mutateAsync(exam)
    setSelectedId(saved.id)
    setCreating(false)
  }

  async function saveResults() {
    if (!draft) return
    try {
      const saved = await save.mutateAsync(draft)
      setDraft(saved)
      setSelectedId(saved.id)
      setSaveFeedback('success')
      window.setTimeout(() => setSaveFeedback('idle'), 2500)
    } catch {
      setSaveFeedback('error')
    }
  }

  return (
    <section className="exams-page">
      <div className="page-heading">
        <div>
          <h1>Imtihonlar</h1>
          <p>Faqat sizga biriktirilgan guruhlar natijalari</p>
        </div>
        <button type="button" onClick={() => setCreating(true)}><Plus size={16} /> Imtihon qo'shish</button>
      </div>

      <div className="course-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input aria-label="Imtihon qidirish" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Imtihon yoki guruh" />
        </label>
      </div>

      {query.isPending && <div className="dashboard-state">Imtihonlar yuklanmoqda...</div>}
      {query.isError && <div className="dashboard-state dashboard-error">Imtihonlar yuklanmadi</div>}
      {creating && <CreateExam groups={groupsQuery.data ?? []} close={() => setCreating(false)} save={(exam) => createExam(exam)} />}

      {exams.length === 0 ? (
        <div className="exams-layout">
          <section className="panel exams-list">
            <header><h2>Imtihonlar arxivi</h2></header>
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: '11px' }}>
              Mavjud imtihonlar yo‘q
            </div>
          </section>

          <div className="exams-main">
            <div className="exam-summary">
              <article><span><BarChart3 size={16} /></span><p>O‘rtacha</p><strong>0/100</strong></article>
              <article><span><Trophy size={16} /></span><p>Eng yuqori</p><strong>0</strong></article>
              <article><span><BarChart3 size={16} /></span><p>Eng past</p><strong>0</strong></article>
              <article><span><Save size={16} /></span><p>O‘quvchilar</p><strong>0</strong></article>
            </div>

            <section className="panel finance-table exams-table">
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                Imtihonlar ro‘yxati bo‘sh. Natijalarni kiritish uchun <strong>+ Imtihon qo'shish</strong> tugmasini bosing.
              </div>
            </section>
          </div>
        </div>
      ) : activeExam && selectedStats ? (
        <div className="exams-layout">
          <section className="panel exams-list">
            <header><h2>Imtihonlar arxivi</h2></header>
            <div>
              {filtered.map((exam) => {
                const itemStats = stats(exam)
                return (
                  <div key={exam.id} className={`exam-archive-item ${exam.id === activeExam.id ? 'active' : ''}`}>
                    <button type="button" onClick={() => requestExamChange(exam.id)}>
                      <span><strong>{exam.name}</strong><small>{exam.groupName}</small></span>
                      <span><CalendarDays size={13} />{formatDate(exam.date)}</span>
                      <small>O‘rtacha: {itemStats.average}/{exam.maxScore}</small>
                    </button>
                    <button
                      type="button"
                      className="exam-delete-btn"
                      title="Imtihonni o‘chirish"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingExamId(exam.id)
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          <div className="exams-main">
            <div className="exam-summary">
              <article><span><BarChart3 size={16} /></span><p>O‘rtacha</p><strong>{selectedStats.average}/{activeExam.maxScore}</strong></article>
              <article><span><Trophy size={16} /></span><p>Eng yuqori</p><strong>{selectedStats.max}</strong></article>
              <article><span><BarChart3 size={16} /></span><p>Eng past</p><strong>{selectedStats.min}</strong></article>
              <article><span><Save size={16} /></span><p>O‘quvchilar</p><strong>{formatter.format(activeExam.results.length)}</strong></article>
            </div>

            <section className="panel finance-table exams-table">
              <header className="exam-results-header">
                <div>
                  <h2>{activeExam.name}</h2>
                  <span className="finance-note">{activeExam.groupName} · {formatDate(activeExam.date)} · maksimal {activeExam.maxScore} ball</span>
                </div>
              </header>
              <div className="table-scroll">
                <table aria-label="Imtihon natijalari">
                  <thead><tr><th>Rank</th><th>O‘quvchi</th><th>Ball</th><th>Foiz</th><th>Izoh</th></tr></thead>
                  <tbody>
                    {sortByRank(activeExam).map((result) => (
                      <tr key={result.studentId}>
                        <td data-label="O‘rin"><strong className="exam-rank">#{result.rank}</strong></td>
                        <td data-label="O‘quvchi"><strong>{result.studentName}</strong><span>{result.studentCode}</span></td>
                        <td data-label="Ball">
                          <input
                            aria-label={`${result.studentName} ball`}
                            type="number"
                            min="0"
                            max={activeExam.maxScore}
                            value={result.score === 0 ? '' : result.score}
                            placeholder="0"
                            onFocus={(event) => event.target.select()}
                            onChange={(event) => updateScore(result.studentId, Number(event.currentTarget.value))}
                          />
                        </td>
                        <td data-label="Natija"><strong className="exam-percent">{Math.round((result.score / activeExam.maxScore) * 100)}%</strong></td>
                        <td data-label="Izoh"><input aria-label={`${result.studentName} izoh`} placeholder="Izoh kiriting" value={result.comment} onChange={(event) => updateComment(result.studentId, event.currentTarget.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(isDirty || save.isPending || saveFeedback !== 'idle') && (
                <footer className="exam-results-actions" aria-live="polite">
                  <span className={`exam-save-status ${saveFeedback}`}>
                    {save.isPending
                      ? 'Natijalar saqlanmoqda...'
                      : saveFeedback === 'success'
                        ? 'Natijalar saqlandi'
                        : saveFeedback === 'error'
                          ? 'Saqlashda xatolik yuz berdi'
                          : 'Saqlanmagan o‘zgarishlar'}
                  </span>
                  {saveFeedback !== 'success' && (
                    <button className="finance-primary-action" type="button" onClick={() => void saveResults()} disabled={save.isPending || !isDirty}>
                      <Save size={15} />{save.isPending ? 'Saqlanmoqda...' : 'Natijalarni saqlash'}
                    </button>
                  )}
                </footer>
              )}
            </section>
          </div>
        </div>
      ) : null}
      {pendingExamId ? (
        <ConfirmDialog
          title="Natijalar saqlanmagan"
          description="Boshqa imtihonga o‘tsangiz, kiritilgan o‘zgarishlar yo‘qoladi."
          confirmLabel="O‘zgarishsiz davom etish"
          onCancel={() => setPendingExamId(null)}
          onConfirm={() => {
            setSelectedId(pendingExamId)
            setPendingExamId(null)
          }}
        />
      ) : null}
      {deletingExamId ? (
        <ConfirmDialog
          title="Imtihonni o‘chirish"
          description="Ushbu amalni ortga qaytarib bo‘lmaydi."
          errorMessage={
            filledResultsCount > 0
              ? `Diqqat: Usbu imtihonni o‘chirish ${filledResultsCount} ta o‘quvchining kiritilgan ballarini va barcha natijalarini butunlay yo‘q qiladi!`
              : null
          }
          variant="danger"
          confirmLabel="Tushundim, baribir o‘chirilsin"
          onCancel={() => setDeletingExamId(null)}
          onConfirm={async () => {
            const idToDelete = deletingExamId
            setDeletingExamId(null)
            await deleteMutation.mutateAsync(idToDelete)
            setDraft(null)
            setSelectedId(null)
            setShowDeletedToast(true)
            window.setTimeout(() => setShowDeletedToast(false), 3000)
          }}
        />
      ) : null}

      {showDeletedToast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            color: '#15803d',
            background: '#f0fdf4',
            border: '1px solid rgb(34 197 94 / 30%)',
            borderRadius: '8px',
            boxShadow: '0 4px 14px rgb(0 0 0 / 8%)',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={16} />
          <span>Imtihon muvaffaqiyatli o‘chirildi</span>
        </div>
      )}
    </section>
  )
}

function CreateExam({ groups, close, save }: { groups: TeacherExamGroup[]; close: () => void; save: (exam: Exam) => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const data = new FormData(event.currentTarget)
    const group = groups.find((item) => item.id === String(data.get('groupId')))
    if (!group) return
    setSubmitting(true)
    try {
      await save({
        id: `te-${Date.now()}`,
        groupId: group.id,
        groupName: group.name,
        name: String(data.get('name')),
        date: displayToIsoDate(String(data.get('date'))),
        maxScore: Number(data.get('maxScore')),
        results: (group.students || []).map((student, index) => ({
          studentId: student.id,
          studentCode: student.code,
          studentName: student.name,
          score: 0,
          comment: '',
          rank: index + 1,
        })),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="teacher-modal group-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>Imtihon qo'shish</h2>
            <p>Faqat sizning guruhlaringiz</p>
          </div>
          <button type="button" aria-label="Yopish" onClick={close}><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="form-wide">Nomi<input name="name" required /></label>
            <label>Guruh<select name="groupId" required>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <label>Sana<DateInput name="date" required aria-label="Sana" /></label>
            <label>Maksimal ball<input name="maxScore" type="number" min="1" required defaultValue="100" /></label>
          </div>
          <footer>
            <button type="button" className="secondary-button" onClick={close} disabled={submitting}>Bekor</button>
            <button className="primary-button" disabled={submitting}>{submitting ? 'Saqlanmoqda...' : 'Saqlash'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
