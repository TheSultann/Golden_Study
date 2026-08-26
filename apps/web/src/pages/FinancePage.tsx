import { Banknote, Check, ChevronDown, CircleDollarSign, Plus, ReceiptText, Search, WalletCards, X } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from 'react'
import type { FinancePayment, FinanceTeacherSalary, FinanceTransaction, Group, Student } from '@golden-study/contracts'
import { useFinance, usePayTeacherSalary, useSaveExpense, useSaveStudentPayment } from '../features/finance/useFinance'
import { useGroups } from '../features/groups/useGroups'
import { useStudents } from '../features/students/useStudents'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { DateInput, displayToIsoDate } from '../shared/ui/DateInput'
import { CopyCodeButton } from '../shared/ui/CopyCodeButton'
import { Pagination } from '../shared/ui/Pagination'

type FinanceTab = 'payments' | 'expenses' | 'salaries' | 'operations'
type FormKind = 'payment' | 'expense'
const PAGE_SIZE = 10
const money = (value: number) => `${new Intl.NumberFormat('uz-UZ').format(value)} UZS`
const formatDate = (value: string | null | undefined) => {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}.${month}.${year}` : value
}
const salaryTypeLabel = (type: 'fixed' | 'per_student' | 'percent') => ({
  fixed: 'Belgilangan',
  per_student: 'O‘quvchi bo‘yicha',
  percent: 'Foiz',
})[type]
const tabs: [FinanceTab, string][] = [['payments', 'To‘lovlar'], ['expenses', 'Xarajatlar'], ['salaries', 'Oyliklar'], ['operations', 'Operatsiyalar']]

const studentLabel = (student: Student) => `${student.firstName} ${student.lastName} · ${student.code}`
type ComboboxOption = { id: string; label: string }
function SearchableCombobox({ label, options, value, placeholder, disabled, onChange }: { label: string; options: ComboboxOption[]; value: string; placeholder: string; disabled?: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0)
  const selected = options.find((option) => option.id === value)
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
  function keyDown(event: KeyboardEvent<HTMLInputElement>) { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((index) => Math.min(index + 1, filtered.length - 1)) } else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)) } else if (event.key === 'Enter' && open && filtered[active]) { event.preventDefault(); onChange(filtered[active].id); setQuery(''); setOpen(false) } else if (event.key === 'Escape') setOpen(false) }
  return <label>{label}<div className="custom-combobox"><input role="combobox" aria-label={label} aria-expanded={open} aria-controls={`${label}-options`} value={open ? query : selected?.label ?? ''} placeholder={placeholder} disabled={disabled} onFocus={() => { setOpen(true); setQuery(''); setActive(0) }} onClick={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0) }} onKeyDown={keyDown}/><ChevronDown size={15}/>{open && <div id={`${label}-options`} className="combobox-options" role="listbox" aria-label={`${label} variantlari`}>{filtered.length ? filtered.map((option, index) => <button type="button" role="option" aria-selected={option.id === value} className={index === active ? 'active' : ''} key={option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.id); setQuery(''); setOpen(false) }}><span>{option.label}</span>{option.id === value && <Check size={14}/>}</button>) : <p>Natija topilmadi</p>}</div>}</div></label>
}
function OperationForm({ kind, groups, students, initialStudentId, close, submit }: { kind: FormKind; groups: Group[]; students: Student[]; initialStudentId?: string; close: () => void; submit: (data: FormData) => Promise<void> }) {
  const payment = kind === 'payment'
  const initialStudent = initialStudentId ? students.find((s) => s.id === initialStudentId) : undefined
  const initialGroup = initialStudent && initialStudent.groups.length > 0 ? groups.find((g) => g.name === initialStudent.groups[0]) : undefined

  const [groupId, setGroupId] = useState(initialGroup?.id ?? '')
  const [studentId, setStudentId] = useState(initialStudentId || '')
  const [amountRaw, setAmountRaw] = useState('')

  const activeGroups = groups.filter((group) => group.active)
  const selectedGroup = activeGroups.find((group) => group.id === groupId)
  const availableStudents = students.filter((student) => student.status === 'active' && (!selectedGroup || student.groups.includes(selectedGroup.name)))
  const selectedStudent = students.find((student) => student.id === studentId)

  const parsedAmount = Number(amountRaw.replaceAll(/\D/g, ''))
  const formattedAmountHint = parsedAmount > 0 ? `${new Intl.NumberFormat('uz-UZ').format(parsedAmount)} so‘m` : ''

  async function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await submit(new FormData(event.currentTarget)); close() }
  return (
    <div className="modal-backdrop">
      <section className="teacher-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>{payment ? 'To‘lov qabul qilish' : 'Xarajat qo‘shish'}</h2>
            <p>{payment ? 'O‘quvchi to‘lovi balansga va jurnalga uriladi' : 'Markaz xarajati jurnalga avtomatik yoziladi'}</p>
          </div>
          <button type="button" onClick={close} aria-label="Yopish"><X size={18} /></button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            {payment ? (
              <>
                <SearchableCombobox label="Guruh" options={activeGroups.map((group) => ({ id: group.id, label: group.name }))} value={groupId} placeholder="Guruhlar bo‘yicha filtr" onChange={(id) => { setGroupId(id); setStudentId('') }}/>
                <SearchableCombobox label="O‘quvchi" options={availableStudents.map((student) => ({ id: student.id, label: studentLabel(student) }))} value={studentId} placeholder={selectedGroup ? `${selectedGroup.name} o‘quvchilari` : 'O‘quvchini tanlang'} onChange={setStudentId}/>
                <input type="hidden" name="groupLabel" value={selectedGroup?.name ?? ''}/>
                <input type="hidden" name="groupId" value={selectedGroup?.id ?? ''}/>
                <input type="hidden" name="studentId" value={selectedStudent?.id ?? ''}/>
                <input type="hidden" name="studentCode" value={selectedStudent?.code ?? ''}/>
                <input type="hidden" name="studentName" value={selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : ''}/>
                <label>To‘lov usuli*
                  <select name="method">
                    <option value="Naqd">Naqd (Cash)</option>
                    <option value="Click">Click</option>
                    <option value="Payme">Payme</option>
                    <option value="Uzum">Uzum</option>
                    <option value="Terminal">Terminal</option>
                    <option value="Bank">Bank</option>
                  </select>
                </label>
                <label>Sana*
                  <DateInput name="paidAt" required aria-label="Sana" />
                </label>
              </>
            ) : (
              <>
                <label>Kategoriya
                  <select name="category">
                    <option>Ijara</option>
                    <option>Kommunal</option>
                    <option>Reklama</option>
                    <option>Jihozlar</option>
                    <option>Boshqa</option>
                  </select>
                </label>
                <label>Qabul qiluvchi
                  <input name="subject" required placeholder="Markaz yoki tashkilot" />
                </label>
              </>
            )}
            <label className="money-input-label">Summa (UZS)*
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="Masalan: 500 000"
                value={amountRaw ? new Intl.NumberFormat('uz-UZ').format(parsedAmount) : ''}
                onChange={(event) => {
                  const val = event.target.value.replaceAll(/\D/g, '')
                  setAmountRaw(val)
                }}
              />
              <input type="hidden" name="amount" value={parsedAmount || ''} />
              {formattedAmountHint ? <small className="form-field-hint">{formattedAmountHint}</small> : null}
            </label>
            <label className="form-wide">Izoh
              <textarea name="comment" placeholder="To‘lov bo‘yicha qo‘shimcha izoh" />
            </label>
          </div>
          <footer>
            <button type="button" className="secondary-button" onClick={close}>Bekor</button>
            <button className="primary-button" disabled={payment ? !selectedStudent : false}>Saqlash</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function FinancePage() {
  const query = useFinance(), paymentMutation = useSaveStudentPayment(), expenseMutation = useSaveExpense(), paySalary = usePayTeacherSalary()
  const groupsQuery = useGroups(), studentsQuery = useStudents()
  const [tab, setTab] = useState<FinanceTab>('payments'), [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const urlStudentId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('studentId') : null
  const [form, setForm] = useState<FormKind | null>(urlStudentId ? 'payment' : null)
  const [pendingSalaryId, setPendingSalaryId] = useState<string | null>(null)
  const data = query.data, q = search.toLowerCase()

  const handleTabChange = (newTab: FinanceTab) => { setTab(newTab); setPage(1) }
  const handleSearchChange = (val: string) => { setSearch(val); setPage(1) }

  useEffect(() => {
    setPage(1)
  }, [tab])

  const transactions = useMemo(() => {
    const list = (data?.transactions ?? []).filter((x: FinanceTransaction) => `${x.subject} ${x.category} ${x.comment}`.toLowerCase().includes(q))
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [data, q])
  const payments = useMemo(() => {
    const list = (data?.payments ?? []).filter((x: FinancePayment) => `${x.studentCode} ${x.studentName} ${x.group}`.toLowerCase().includes(q))
    return [...list].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
  }, [data, q])
  const salariesList = useMemo(() => (data?.salaries ?? []).filter((x: FinanceTeacherSalary) => `${x.teacherName} ${x.role} ${x.groups.join(' ')}`.toLowerCase().includes(q)), [data, q])
  const expenses = useMemo(() => transactions.filter((x: FinanceTransaction) => x.type === 'expense'), [transactions])

  const paginatedPayments = useMemo(() => payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [payments, page])
  const paginatedExpenses = useMemo(() => expenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [expenses, page])
  const paginatedSalaries = useMemo(() => salariesList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [salariesList, page])
  const paginatedTransactions = useMemo(() => transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [transactions, page])

  const pendingSalary = data?.salaries.find((salary: FinanceTeacherSalary) => salary.id === pendingSalaryId)
  async function submit(fd: FormData) { const amount = Number(fd.get('amount')), comment = String(fd.get('comment')); if (form === 'payment') await paymentMutation.mutateAsync({ studentId: String(fd.get('studentId')), groupId: String(fd.get('groupId')), studentCode: String(fd.get('studentCode')), studentName: String(fd.get('studentName')), group: String(fd.get('groupLabel')), method: String(fd.get('method')), amount, comment, paidAt: displayToIsoDate(String(fd.get('paidAt'))) }); else await expenseMutation.mutateAsync({ category: String(fd.get('category')), subject: String(fd.get('subject')), amount, comment }) }
  if (query.isPending) return <section className="finance-page"><div className="page-heading"><h1>Moliya</h1></div><div className="dashboard-state">Moliya yuklanmoqda...</div></section>
  if (query.isError || !data) return <section className="finance-page"><div className="page-heading"><h1>Moliya</h1></div><div className="dashboard-state dashboard-error">Moliya ma’lumotlari yuklanmadi</div></section>
  const rawGroups = groupsQuery.data
  const groupsList: Group[] = Array.isArray(rawGroups) ? rawGroups : Array.isArray((rawGroups as any)?.data) ? (rawGroups as any).data : []

  const rawStudents = studentsQuery.data
  const studentsList: Student[] = Array.isArray(rawStudents) ? rawStudents : Array.isArray((rawStudents as any)?.data) ? (rawStudents as any).data : []

  return (
    <section className="finance-page">
      <div className="page-heading"><div><h1>Moliya</h1><p>To‘lovlar, xarajatlar, oyliklar va operatsiyalar jurnali</p></div></div>
      <div className="finance-summary"><article><span><CircleDollarSign size={16} /></span><p>Kirim</p><strong>{money(data.summary.income)}</strong></article><article><span><ReceiptText size={16} /></span><p>Chiqim</p><strong>{money(data.summary.expense)}</strong></article><article><span><WalletCards size={16} /></span><p>To‘lanadigan oylik</p><strong>{money(data.summary.salaryDebt)}</strong></article><article className="profit-card"><span><Banknote size={16} /></span><p>Sof foyda</p><strong>{money(data.summary.profit)}</strong></article></div>
      <div className="finance-toolbar"><div className="finance-tabs">{tabs.map(([v,l]) => <button key={v} className={tab === v ? 'active' : ''} onClick={() => handleTabChange(v)}>{l}</button>)}</div><label className="search-field"><Search size={16}/><input aria-label="Moliya qidirish" value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Kod, ism, kategoriya"/></label></div>
      {tab === 'payments' && <section className="panel finance-table"><header><div><h2>O‘quvchi to‘lovlari</h2><span className="finance-note">To‘lovlar tarixi</span></div><button className="finance-primary-action" onClick={() => setForm('payment')}><Plus size={14}/> To‘lov qo‘shish</button></header><div className="table-scroll"><table aria-label="To‘lovlar ro‘yxati"><thead><tr><th>O‘quvchi</th><th>Guruh</th><th>Usul</th><th>Sana</th><th>Summa</th></tr></thead><tbody>{paginatedPayments.map((x: FinancePayment) => <tr key={x.id}><td data-label="O‘quvchi"><div className="student-identity-cell"><strong>{x.studentName}</strong><CopyCodeButton code={x.studentCode} /></div></td><td data-label="Guruh">{x.group}</td><td data-label="Usul">{x.method}</td><td data-label="Sana">{formatDate(x.paidAt)}</td><td data-label="Summa" className="credit">{money(x.amount)}</td></tr>)}</tbody></table></div><Pagination page={page} totalPages={Math.ceil(payments.length / PAGE_SIZE)} totalItems={payments.length} pageSize={PAGE_SIZE} onPageChange={setPage} /></section>}
      {tab === 'expenses' && <section className="panel finance-table"><header><div><h2>Xarajatlar</h2><span className="finance-note">Markaz xarajatlari</span></div><button className="finance-primary-action" onClick={() => setForm('expense')}><Plus size={14}/> Xarajat qo‘shish</button></header><div className="table-scroll"><table aria-label="Xarajatlar ro‘yxati"><thead><tr><th>Kategoriya</th><th>Qabul qiluvchi</th><th>Izoh</th><th>Sana</th><th>Summa</th></tr></thead><tbody>{paginatedExpenses.map((x: FinanceTransaction) => <tr key={x.id}><td data-label="Kategoriya">{x.category}</td><td data-label="Qabul qiluvchi">{x.subject}</td><td data-label="Izoh">{x.comment}</td><td data-label="Sana">{formatDate(x.createdAt)}</td><td data-label="Summa" className="debt">{money(x.amount)}</td></tr>)}</tbody></table></div><Pagination page={page} totalPages={Math.ceil(expenses.length / PAGE_SIZE)} totalItems={expenses.length} pageSize={PAGE_SIZE} onPageChange={setPage} /></section>}
      {tab === 'salaries' && (
        <section className="panel finance-table">
          <header>
            <div>
              <h2>Xodimlar va o‘qituvchilar ish haqlari</h2>
              <span className="finance-note">Barcha xodimlar va o‘qituvchilar ish haqini to‘lash va kassa hisobini yuritish bo‘limi</span>
            </div>
          </header>
          <div className="table-scroll">
            <table aria-label="Oyliklar ro‘yxati">
              <thead>
                <tr>
                  <th>Xodim / O‘qituvchi</th>
                  <th>Rol</th>
                  <th>Hisob turi</th>
                  <th>Stavka / Oylik</th>
                  <th>Guruhlar</th>
                  <th>To‘lanadigan oylik</th>
                  <th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSalaries.map((x) => {
                  const alreadyPaid = x.isPaidThisMonth
                  return (
                    <tr key={x.id}>
                      <td data-label="Xodim / O‘qituvchi"><strong>{x.teacherName}</strong></td>
                      <td data-label="Rol"><span className="status status-muted">{x.role || "O'qituvchi"}</span></td>
                      <td data-label="Hisob turi">{salaryTypeLabel(x.salaryType)}</td>
                      <td data-label="Stavka / Oylik">{x.salaryType === 'percent' ? `${x.rate}%` : money(x.rate)}</td>
                      <td data-label="Guruhlar">{x.groups.length ? x.groups.join(', ') : '—'}</td>
                      <td data-label="To‘lanadigan oylik" className="credit">{money(x.kpiBalance)}</td>
                      <td data-label="Amal">
                        <button
                          type="button"
                          className="finance-pay-button"
                          disabled={paySalary.isPending}
                          onClick={() => setPendingSalaryId(x.id)}
                        >
                          {alreadyPaid ? 'Takroriy to‘lov' : 'Oylik berish'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={Math.ceil(salariesList.length / PAGE_SIZE)} totalItems={salariesList.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </section>
      )}
      {tab === 'operations' && <section className="panel finance-table"><header><div><h2>Operatsiyalar jurnali</h2><span className="finance-note">Yozuvlar o‘chirilmaydi va tahrirlanmaydi</span></div></header><div className="table-scroll"><table aria-label="Operatsiyalar jurnali"><thead><tr><th>Turi</th><th>Kategoriya</th><th>Subyekt</th><th>Izoh</th><th>Sana</th><th>Summa</th></tr></thead><tbody>{paginatedTransactions.map(x => <tr key={x.id}><td data-label="Turi">{x.type === 'income' ? 'Kirim' : 'Chiqim'}</td><td data-label="Kategoriya">{x.category}</td><td data-label="Subyekt">{x.subject}</td><td data-label="Izoh">{x.comment}</td><td data-label="Sana">{formatDate(x.createdAt)}</td><td data-label="Summa" className={x.type === 'income' ? 'credit' : 'debt'}>{money(x.amount)}</td></tr>)}</tbody></table></div><Pagination page={page} totalPages={Math.ceil(transactions.length / PAGE_SIZE)} totalItems={transactions.length} pageSize={PAGE_SIZE} onPageChange={setPage} /></section>}
      {form && <OperationForm kind={form} groups={groupsList} students={studentsList} initialStudentId={urlStudentId ?? undefined} close={() => setForm(null)} submit={submit}/>}
      {pendingSalary && (() => {
        const alreadyPaid = pendingSalary.isPaidThisMonth
        const paidDate = pendingSalary.lastSalaryPaidAt
        return (
          <ConfirmDialog
            title={alreadyPaid ? '⚠️ Oylik allaqachon berilgan' : 'Oylik to‘lovini tasdiqlash'}
            description={
              alreadyPaid
                ? `⚠️ Diqqat: ${pendingSalary.teacherName} uchun ushbu oyda (${formatDate(paidDate)}) allaqachon oylik berilgan! Qayta oylik berishni tasdiqlaysizmi? ${money(pendingSalary.kpiBalance)} Moliya (Chiqim) "Xodimlar ish haqi" kategoriyasiga yoziladi.`
                : `${pendingSalary.teacherName} (${pendingSalary.role || "Xodim"}) uchun ${money(pendingSalary.kpiBalance)} oylik beriladi va Moliyaga (Chiqim) yoziladi.`
            }
            confirmLabel={alreadyPaid ? 'Ha, qayta berish' : 'Oylikni berish'}
            pending={paySalary.isPending}
            onCancel={() => setPendingSalaryId(null)}
            onConfirm={() =>
              paySalary.mutate(
                { id: pendingSalary.id, recipientType: pendingSalary.recipientType, amount: pendingSalary.kpiBalance },
                { onSuccess: () => setPendingSalaryId(null) },
              )
            }
          />
        )
      })()}
    </section>
  )
}
