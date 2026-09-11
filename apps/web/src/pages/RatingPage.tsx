import { Search, Trophy, TrendingUp, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTeacherRating } from '../features/teacher-rating/useTeacherRating'
import { CopyCodeButton } from '../shared/ui/CopyCodeButton'

export function RatingPage() {
  const teacherRatingQuery = useTeacherRating()
  const [group, setGroup] = useState('all')
  const [search, setSearch] = useState('')

  const rating = useMemo(() => teacherRatingQuery.data ?? [], [teacherRatingQuery.data])

  const groups = useMemo(() => {
    const set = new Set<string>()
    rating.forEach((row) => { if (row.groupName && row.groupName !== '—') set.add(row.groupName) })
    return Array.from(set).sort()
  }, [rating])

  const filtered = useMemo(() => rating.filter((row) => {
    const query = search.toLowerCase()
    return (group === 'all' || row.groupName === group)
      && (!query || `${row.studentName} ${row.studentCode} ${row.groupName}`.toLowerCase().includes(query))
  }), [group, rating, search])

  const loading = teacherRatingQuery.isPending
  const error = teacherRatingQuery.isError

  return (
    <section className="rating-page">
      <div className="page-heading">
        <div>
          <h1>Reyting</h1>
          <p>Imtihon natijalari, davomat bahosi va uy vazifasi asosida leaderboard</p>
        </div>
      </div>

      {loading && <div className="dashboard-state">Reyting yuklanmoqda...</div>}
      {error && <div className="dashboard-state dashboard-error">Reyting yuklanmadi</div>}

      <div className="rating-toolbar">
        <label className="search-field"><Search size={16} /><input aria-label="Reyting qidirish" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O'quvchi yoki ST-ID" /></label>
        <select aria-label="Guruh reytingi" value={group} onChange={(event) => setGroup(event.target.value)}>
          <option value="all">Barcha guruhlar</option>
          {groups.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="rating-summary">
        <article><span><UsersRound size={16} /></span><p>O'quvchilar</p><strong>{filtered.length}</strong></article>
        <article><span><Trophy size={16} /></span><p>Eng yuqori ball</p><strong>{filtered[0]?.totalScore ?? 0}</strong></article>
        <article><span><TrendingUp size={16} /></span><p>O'rtacha ball</p><strong>{filtered.length ? Math.round(filtered.reduce((sum, row) => sum + row.totalScore, 0) / filtered.length) : 0}</strong></article>
      </div>

      <section className="panel rating-table">
        <header><h2>Leaderboard</h2><span>{filtered.length} ta o'quvchi</span></header>
        <div className="table-scroll">
          <table aria-label="O'quvchilar reytingi">
            <thead><tr><th>Joy</th><th>O'quvchi</th><th>Guruh</th><th>Imtihon</th><th>Davomat</th><th>Uy vazifasi</th><th>Baho</th><th>Ball</th></tr></thead>
            <tbody>{filtered.map((row, index) => <tr key={row.studentId} className={index === 0 ? 'place-1' : ''}><td data-label="Joy"><strong>#{index + 1}</strong></td><td data-label="O'quvchi"><div className="student-identity-cell"><strong>{row.studentName}</strong><CopyCodeButton code={row.studentCode} /></div></td><td data-label="Guruh">{row.groupName}</td><td data-label="Imtihon">{row.averagePercent}%<small>{row.examsCount} imtihon</small></td><td data-label="Davomat">{row.attendanceRate}%</td><td data-label="Uy vazifasi">{row.homeworkRate}%</td><td data-label="Baho">{row.attendanceRating}%</td><td data-label="Ball"><b>{row.totalScore}</b></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
