import type { AttendanceSession, Exam, FinanceOverview } from '@golden-study/contracts'
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, CircleDollarSign, Download, FileSpreadsheet, FileText, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { useAttendance } from '../features/attendance/useAttendance'
import { useExams } from '../features/exams/useExams'
import { useFinance } from '../features/finance/useFinance'
import { createCashflowSummary, type ReportTone } from '../features/reports/reportSummary'

type ReportTab = 'income' | 'debts' | 'attendance' | 'exams' | 'cashflow'
type ExportKind = 'excel' | 'csv' | 'pdf'

const tabs: [ReportTab, string][] = [
  ['income', 'Tushumlar'],
  ['debts', 'Qarzlar'],
  ['attendance', 'Davomat'],
  ['exams', 'Imtihonlar'],
  ['cashflow', 'Kirim-chiqim'],
]

const money = (value: number) => `${new Intl.NumberFormat('uz-UZ').format(value)} UZS`

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}.${month}.${year}` : value
}

const attendanceLabels: Record<AttendanceSession['rows'][number]['status'], string> = {
  came: 'Keldi',
  excused: 'Sababli',
  absent: 'Sababsiz',
  unmarked: 'Belgilanmagan',
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function exportReport(kind: ExportKind, tab: ReportTab, finance?: FinanceOverview, attendance?: AttendanceSession, exams?: Exam[]) {
  const lines = [`Hisobot: ${tab}`, `Format: ${kind.toUpperCase()}`, `Sana: ${new Date().toISOString()}`]
  if (tab === 'income' && finance) finance.payments.forEach((item) => lines.push(`${item.paidAt};${item.studentCode};${item.studentName};${item.group};${item.amount}`))
  if (tab === 'debts' && finance) finance.debts.forEach((item) => lines.push(`${item.studentCode};${item.studentName};${item.group};${item.parentPhone};${item.balance}`))
  if (tab === 'cashflow' && finance) finance.transactions.forEach((item) => lines.push(`${item.createdAt};${item.type};${item.category};${item.subject};${item.amount}`))
  if (tab === 'attendance' && attendance) attendance.rows.forEach((item) => lines.push(`${attendance.date};${attendance.groupName};${item.studentCode};${item.studentName};${item.status};${item.rating}`))
  if (tab === 'exams' && exams) exams.forEach((exam) => lines.push(`${exam.date};${exam.groupName};${exam.name};avg=${avgScore(exam)};max=${exam.maxScore}`))
  downloadText(`hisobot-${tab}.${kind === 'excel' ? 'xls' : kind}`, lines.join('\n'))
}

function avgScore(exam: Exam) {
  if (!exam.results.length) return 0
  return Math.round(exam.results.reduce((sum, item) => sum + item.score, 0) / exam.results.length)
}

function summaryTone(tab: ReportTab, index: number, label: string): ReportTone {
  if (tab === 'income' && index === 0) return 'income'
  if (tab === 'debts' && index === 0) return 'expense'
  if (label === 'Kirim') return 'income'
  if (label === 'Chiqim') return 'expense'
  if (label === 'Sof foyda') return 'profit'
  if (label === 'Zarar') return 'loss'
  return 'neutral'
}

function SummaryIcon({ tone }: { tone: ReportTone }) {
  if (tone === 'income') return <ArrowDownToLine size={15} />
  if (tone === 'expense' || tone === 'loss') return <ArrowUpFromLine size={15} />
  if (tone === 'profit') return <CircleDollarSign size={15} />
  return <ReceiptText size={15} />
}

function ExportButtons({ tab, finance, attendance, exams }: { tab: ReportTab; finance?: FinanceOverview; attendance?: AttendanceSession; exams?: Exam[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="report-export">
      <button className="report-export-trigger" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}><Download size={14} /> Eksport <ChevronDown size={13} /></button>
      {open && <div className="report-export-menu">
        <button type="button" onClick={() => exportReport('excel', tab, finance, attendance, exams)}><FileSpreadsheet size={14} /> Excel</button>
        <button type="button" onClick={() => exportReport('csv', tab, finance, attendance, exams)}><Download size={14} /> CSV</button>
        <button type="button" onClick={() => exportReport('pdf', tab, finance, attendance, exams)}><FileText size={14} /> PDF</button>
      </div>}
    </div>
  )
}

function reportSummary(tab: ReportTab, finance: FinanceOverview, attendance: AttendanceSession, exams: Exam[]) {
  const attendanceStats = {
    came: attendance.rows.filter((item) => item.status === 'came').length,
    excused: attendance.rows.filter((item) => item.status === 'excused').length,
    absent: attendance.rows.filter((item) => item.status === 'absent').length,
  }
  const allScores = exams.flatMap((exam) => exam.results.map((result) => result.score))
  if (tab === 'income') return [
    ['Jami tushum', money(finance.summary.income)],
    ['To‘lovlar', `${finance.payments.length} ta`],
    ['O‘rtacha to‘lov', money(finance.payments.length ? Math.round(finance.payments.reduce((sum, item) => sum + item.amount, 0) / finance.payments.length) : 0)],
    ['Eng katta to‘lov', money(Math.max(0, ...finance.payments.map((item) => item.amount)))],
  ]
  if (tab === 'debts') return [
    ['Jami qarz', money(finance.summary.debt)],
    ['Qarzdorlar', `${finance.debts.length} ta`],
    ['O‘rtacha qarz', money(finance.debts.length ? Math.round(finance.summary.debt / finance.debts.length) : 0)],
    ['Eng katta qarz', money(Math.max(0, ...finance.debts.map((item) => Math.abs(item.balance))))],
  ]
  if (tab === 'attendance') return [
    ['Jami', `${attendance.rows.length} ta`],
    ['Keldi', `${attendanceStats.came} ta`],
    ['Sababli', `${attendanceStats.excused} ta`],
    ['Sababsiz', `${attendanceStats.absent} ta`],
  ]
  if (tab === 'exams') return [
    ['Imtihonlar', `${exams.length} ta`],
    ['Natijalar', `${allScores.length} ta`],
    ['O‘rtacha ball', `${allScores.length ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length) : 0}`],
    ['Eng yuqori', `${Math.max(0, ...allScores)}`],
  ]
  return createCashflowSummary(finance.summary, finance.transactions.length)
    .map(({ label, value }) => [label, value])
}

export function ReportsPage() {
  const financeQuery = useFinance()
  const attendanceQuery = useAttendance('g1', '2026-07-06')
  const examsQuery = useExams()
  const [tab, setTab] = useState<ReportTab>('income')
  const finance = financeQuery.data
  const attendance = attendanceQuery.data
  const exams = examsQuery.data
  const loading = financeQuery.isPending || attendanceQuery.isPending || examsQuery.isPending
  const error = financeQuery.isError || attendanceQuery.isError || examsQuery.isError
  const attendanceStats = attendance?.rows ? {
    came: attendance.rows.filter((item) => item.status === 'came').length,
    excused: attendance.rows.filter((item) => item.status === 'excused').length,
    absent: attendance.rows.filter((item) => item.status === 'absent').length,
  } : null
  const summaryItems = finance && attendance && exams ? reportSummary(tab, finance, attendance, exams) : []

  return (
    <section className="finance-page reports-page">
      <div className="page-heading">
        <div>
          <h1>Hisobotlar</h1>
          <p>Read-only tahlil, eksport va boshqaruv ko‘rsatkichlari</p>
        </div>
      </div>

      {loading && <div className="dashboard-state">Hisobotlar yuklanmoqda...</div>}
      {error && <div className="dashboard-state dashboard-error">Hisobotlar yuklanmadi</div>}

      <div className="finance-toolbar reports-toolbar">
        <div className="finance-tabs reports-tabs" aria-label="Hisobot turi">{tabs.map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>)}</div>
        {finance && attendance && exams && <ExportButtons tab={tab} finance={finance} attendance={attendance} exams={exams} />}
      </div>

      {finance && attendance && exams && (
        <>
          <div className="reports-summary" data-testid="reports-summary">
            {summaryItems.map(([label, value], index) => {
              const tone = summaryTone(tab, index, label)
              return (
                <article key={label} className={`reports-summary--${tone}`}>
                  <div className="reports-summary-label"><span><SummaryIcon tone={tone} /></span><p>{label}</p></div>
                  <strong>{value}</strong>
                </article>
              )
            })}
          </div>

          {tab === 'income' && <IncomeReport finance={finance} />}
          {tab === 'debts' && <DebtsReport finance={finance} />}
          {tab === 'attendance' && <AttendanceReport attendance={attendance} stats={attendanceStats} />}
          {tab === 'exams' && <ExamsReport exams={exams} />}
          {tab === 'cashflow' && <CashflowReport finance={finance} />}
        </>
      )}
    </section>
  )
}

function IncomeReport({ finance }: { finance: FinanceOverview }) {
  return <section className="panel finance-table report-panel"><header><h2>To‘lovlar tafsiloti</h2><span className="finance-note">{finance.payments.length} ta to‘lov</span></header><div className="table-scroll"><table aria-label="Tushumlar hisoboti"><thead><tr><th>Sana</th><th>O‘quvchi</th><th>Guruh</th><th>Usul</th><th>Summa</th></tr></thead><tbody>{finance.payments.map((item) => <tr key={item.id}><td data-label="Sana">{formatDate(item.paidAt)}</td><td data-label="O‘quvchi"><strong>{item.studentName}</strong><span>{item.studentCode}</span></td><td data-label="Guruh">{item.group}</td><td data-label="Usul">{item.method}</td><td data-label="Summa" className="credit">{money(item.amount)}</td></tr>)}</tbody></table></div></section>
}

function DebtsReport({ finance }: { finance: FinanceOverview }) {
  return <section className="panel finance-table report-panel"><header><h2>Qarzdorlar vedomosti</h2><span className="finance-note">{finance.debts.length} o‘quvchi</span></header><div className="table-scroll"><table aria-label="Qarzdorlar ro‘yxati"><thead><tr><th>O‘quvchi</th><th>Guruh</th><th>Ota-ona telefoni</th><th>Qarz</th></tr></thead><tbody>{finance.debts.map((item) => <tr key={item.id}><td data-label="O‘quvchi"><strong>{item.studentName}</strong><span>{item.studentCode}</span></td><td data-label="Guruh">{item.group}</td><td data-label="Ota-ona telefoni">{item.parentPhone}</td><td data-label="Qarz" className="debt">{money(Math.abs(item.balance))}</td></tr>)}</tbody></table></div></section>
}

function AttendanceReport({ attendance, stats }: { attendance: AttendanceSession; stats: { came: number; excused: number; absent: number } | null }) {
  return <section className="panel finance-table report-panel"><header><h2>Akademik davomat</h2><span className="finance-note">{attendance.groupName} · {formatDate(attendance.date)}</span></header><div className="attendance-summary"><span>Jami: {attendance.rows.length}</span><span className="came">Keldi: {stats?.came ?? 0}</span><span className="excused">Sababli: {stats?.excused ?? 0}</span><span className="absent">Sababsiz: {stats?.absent ?? 0}</span></div><div className="table-scroll"><table aria-label="Akademik davomat hisoboti"><thead><tr><th>O‘quvchi</th><th>Holat</th><th>Reyting</th><th>Uy vazifasi</th><th>Izoh</th></tr></thead><tbody>{attendance.rows.map((item) => <tr key={item.studentId}><td data-label="O‘quvchi"><strong>{item.studentName}</strong><span>{item.studentCode}</span></td><td data-label="Holat"><span className={`telegram-status ${item.status === 'came' ? 'sent' : item.status === 'absent' ? 'failed' : 'queued'}`}>{attendanceLabels[item.status]}</span></td><td data-label="Reyting">{item.rating}%</td><td data-label="Uy vazifasi">{item.homeworkDone ? 'Bajarilgan' : 'Bajarilmagan'}</td><td data-label="Izoh">{item.comment || '-'}</td></tr>)}</tbody></table></div></section>
}

function ExamsReport({ exams }: { exams: Exam[] }) {
  return <section className="panel finance-table report-panel"><header><h2>Imtihonlar analitikasi</h2><span className="finance-note">{exams.length} ta imtihon</span></header><div className="table-scroll"><table aria-label="Imtihonlar analitikasi"><thead><tr><th>Sana</th><th>Guruh</th><th>Imtihon</th><th>O‘rtacha</th><th>Eng yuqori</th><th>Eng past</th></tr></thead><tbody>{exams.map((exam) => { const scores = exam.results.map((item) => item.score); return <tr key={exam.id}><td data-label="Sana">{formatDate(exam.date)}</td><td data-label="Guruh">{exam.groupName}</td><td data-label="Imtihon"><strong>{exam.name}</strong><span>{exam.results.length} o‘quvchi</span></td><td data-label="O‘rtacha">{avgScore(exam)}/{exam.maxScore}</td><td data-label="Eng yuqori">{scores.length ? Math.max(...scores) : 0}</td><td data-label="Eng past">{scores.length ? Math.min(...scores) : 0}</td></tr> })}</tbody></table></div></section>
}

function CashflowReport({ finance }: { finance: FinanceOverview }) {
  return <section className="panel finance-table report-panel"><header><h2>KIRIM-CHIQIM kitobi</h2><span className="finance-note">{finance.transactions.length} operatsiya</span></header><div className="table-scroll"><table aria-label="Kirim-chiqim hisoboti"><thead><tr><th>Turi</th><th>Kategoriya</th><th>Subyekt</th><th>Sana</th><th>Izoh</th><th>Summa</th></tr></thead><tbody>{finance.transactions.map((item) => <tr key={item.id}><td data-label="Turi"><span className={`telegram-status ${item.type === 'income' ? 'sent' : 'failed'}`}>{item.type === 'income' ? 'Kirim' : 'Chiqim'}</span></td><td data-label="Kategoriya">{item.category}</td><td data-label="Subyekt">{item.subject}</td><td data-label="Sana">{formatDate(item.createdAt)}</td><td data-label="Izoh">{item.comment}</td><td data-label="Summa" className={item.type === 'income' ? 'credit' : 'debt'}>{money(item.amount)}</td></tr>)}</tbody></table></div></section>
}
