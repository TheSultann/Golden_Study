import {
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Search,
  WalletCards,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { useTeacherSalary } from '../features/teacher-salary/useTeacherSalary'
import { Pagination } from '../shared/ui/Pagination'

const money = (value: number) => `${new Intl.NumberFormat('uz-UZ').format(value)} UZS`

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return { date: '—', time: '' }
  const d = new Date(value)
  if (isNaN(d.getTime())) return { date: value, time: '' }
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return {
    date: `${day}.${month}.${year}`,
    time: `${hours}:${mins}`,
  }
}

const PAGE_SIZE = 10

export function TeacherSalaryPage() {
  const query = useTeacherSalary()
  const data = query.data

  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filteredHistory = useMemo(() => {
    if (!data?.history) return []
    return data.history.filter((item) => {
      const matchesTab = filter === 'all' || item.status === filter
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        (item.comment && item.comment.toLowerCase().includes(search.toLowerCase())) ||
        item.amountUzs.toString().includes(search)
      return matchesTab && matchesSearch
    })
  }, [data?.history, filter, search])

  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredHistory.slice(start, start + PAGE_SIZE)
  }, [filteredHistory, page])

  const salaryRateValue = useMemo(() => {
    if (!data) return '—'
    if (data.salaryType === 'percent') return `${data.salaryRate}%`
    return money(data.salaryRate)
  }, [data])

  const salaryRateBadge = useMemo(() => {
    if (!data) return null
    if (data.salaryType === 'percent') return 'KPI'
    if (data.salaryType === 'per_student') return 'Har o‘quvchiga'
    return 'Oylik (Fiks)'
  }, [data])

  const salaryTypeSubtitle = useMemo(() => {
    if (!data) return ''
    if (data.salaryType === 'percent') return 'Har bir dars to‘lovidan foiz'
    if (data.salaryType === 'per_student') return 'Faol o‘quvchilar soni bo‘yicha'
    return 'Oylik qat‘iy belgilangan maosh'
  }, [data])

  return (
    <section className="dashboard-page teacher-salary-page">
      <div className="page-heading">
        <div>
          <h1>Maoshim</h1>
          <p>{data ? `${data.teacherName} — Oylik maosh va hisob-kitoblar statistikasi` : 'Oylik maosh statistikasi va to‘lovlar tarixi'}</p>
        </div>
      </div>

      {query.isPending ? <div className="dashboard-state">Maosh ma'lumotlari yuklanmoqda...</div> : null}
      {query.isError ? <div className="dashboard-state dashboard-error">Maosh ma'lumotlarini yuklab bo'lmadi</div> : null}

      {data ? (
        <>
          <div className="stats-grid">
            <div className="stat salary-stat-card">
              <span className="stat-icon stat-gold">
                <Clock3 size={20} />
              </span>
              <div className="salary-stat-content">
                <p>Kutilayotgan maosh</p>
                <strong>{money(data.pendingBalanceUzs)}</strong>
                <small className="salary-stat-subtitle">To‘lovga kutilayotgan qoldiq</small>
              </div>
            </div>

            <div className="stat salary-stat-card">
              <span className="stat-icon stat-green">
                <CheckCircle2 size={20} />
              </span>
              <div className="salary-stat-content">
                <p>Jami to‘langan</p>
                <strong>{money(data.totalPaidUzs)}</strong>
                <small className="salary-stat-subtitle">Shu kungacha berilgan maosh</small>
              </div>
            </div>

            <div className="stat salary-stat-card">
              <span className="stat-icon stat-blue">
                <CircleDollarSign size={20} />
              </span>
              <div className="salary-stat-content">
                <p>Stavka / Tarif</p>
                <div className="salary-rate-row">
                  <strong>{salaryRateValue}</strong>
                  {salaryRateBadge ? <span className="salary-rate-badge">{salaryRateBadge}</span> : null}
                </div>
                <small className="salary-stat-subtitle">{salaryTypeSubtitle}</small>
              </div>
            </div>

            <div className="stat salary-stat-card">
              <span className="stat-icon stat-violet">
                <CalendarCheck size={20} />
              </span>
              <div className="salary-stat-content">
                <p>Oxirgi to‘lov sanasi</p>
                <strong>{data.lastPaidAt ? formatDateTime(data.lastPaidAt).date : '—'}</strong>
                <small className="salary-stat-subtitle">
                  {data.lastPaidAt ? 'Muvaffaqiyatli berilgan' : 'To‘lovlar hali berilmagan'}
                </small>
              </div>
            </div>
          </div>

          <section className="panel salary-history-panel">
            <header>
              <div>
                <h2>Maosh va to‘lovlar tarixi</h2>
                <span className="finance-note">Barcha hisoblangan va to‘langan summalar ro‘yxati</span>
              </div>
            </header>

            <div className="salary-toolbar">
              <div className="salary-tabs">
                <button
                  type="button"
                  className={filter === 'all' ? 'active' : ''}
                  onClick={() => {
                    setFilter('all')
                    setPage(1)
                  }}
                >
                  Barchasi ({data.history.length})
                </button>
                <button
                  type="button"
                  className={filter === 'paid' ? 'active' : ''}
                  onClick={() => {
                    setFilter('paid')
                    setPage(1)
                  }}
                >
                  To‘langan ({data.history.filter((h) => h.status === 'paid').length})
                </button>
                <button
                  type="button"
                  className={filter === 'pending' ? 'active' : ''}
                  onClick={() => {
                    setFilter('pending')
                    setPage(1)
                  }}
                >
                  Kutilmoqda ({data.history.filter((h) => h.status === 'pending').length})
                </button>
              </div>

              <label className="search-field">
                <Search size={15} />
                <input
                  aria-label="Tarixdan qidirish"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Qidirish (izoh, summa)..."
                />
              </label>
            </div>

            <div className="table-scroll">
              <table aria-label="Maosh tarixi">
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Sana</th>
                    <th>Amal / Tavsif</th>
                    <th style={{ width: '160px' }}>Turi</th>
                    <th style={{ width: '160px' }}>Summa</th>
                    <th style={{ width: '130px' }}>Holati</th>
                    <th>Izoh</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="salary-empty-state">
                          <WalletCards size={32} />
                          <p>Hech qanday maosh yozuvi topilmadi</p>
                          <span>Barcha hisoblangan maoshlar va to‘lovlar shu yerda ko‘rinadi</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedHistory.map((item) => {
                      const isPending = item.status === 'pending'
                      const isPayout = item.type === 'payout'
                      const { date, time } = formatDateTime(item.date)

                      return (
                        <tr key={item.id}>
                          <td data-label="Sana">
                            <div className="salary-date-cell">
                              <span className="salary-date-main">{date}</span>
                              {time ? <span className="salary-date-time">{time}</span> : null}
                            </div>
                          </td>
                          <td data-label="Amal / Tavsif">
                            <span className="salary-title-cell" title={item.title}>
                              {item.title}
                            </span>
                          </td>
                          <td data-label="Turi">
                            <span className={`salary-type-tag ${isPayout ? 'type-payout' : 'type-accrual'}`}>
                              {isPayout ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
                              {isPayout ? 'To‘langan' : 'Kutilmoqda'}
                            </span>
                          </td>
                          <td data-label="Summa">
                            <span
                              className={`salary-amount ${isPending ? 'amount-pending' : 'amount-accrual'}`}
                            >
                              {money(item.amountUzs)}
                            </span>
                          </td>
                          <td data-label="Holati">
                            <span
                              className={`salary-badge ${isPending ? 'salary-badge-pending' : 'salary-badge-paid'}`}
                            >
                              {isPending ? (
                                <>
                                  <Clock3 size={12} /> Kutilmoqda
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={12} /> To‘langan
                                </>
                              )}
                            </span>
                          </td>
                          <td data-label="Izoh">
                            <span className="salary-comment" title={item.comment || undefined}>
                              {item.comment || '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={Math.ceil(filteredHistory.length / PAGE_SIZE)}
              totalItems={filteredHistory.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </section>
        </>
      ) : null}
    </section>
  )
}
