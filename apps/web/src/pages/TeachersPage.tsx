import { AlertCircle, Check, CheckCircle2, Copy, Eye, EyeOff, MoreHorizontal, Plus, Search, Trash2, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import type { SalaryType, Teacher } from '../features/teachers/teacher.types'
import { useSaveTeacher, useSetTeacherActive, useTeachers } from '../features/teachers/useTeachers'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { PhoneInput } from '../shared/ui/PhoneInput'
import { Pagination } from '../shared/ui/Pagination'
import { joinFullName, splitFullName } from '../shared/utils/fullName'

const salaryLabels: Record<SalaryType, string> = { fixed: 'Oylik (fiks)', per_student: 'Har bir o‘quvchi uchun', percent: 'KPI foizi' }
const money = new Intl.NumberFormat('uz-UZ')
const emptyTeachers: Teacher[] = []

type TeacherFormProps = {
  teacher?: Teacher
  pending: boolean
  error: unknown
  onClose: () => void
  onSave: (teacher: Teacher) => void
}

function TeacherForm({ teacher, pending, error, onClose, onSave }: TeacherFormProps) {
  const [fullName, setFullName] = useState(() => teacher ? joinFullName(teacher.firstName, teacher.lastName) : '')
  const [phone, setPhone] = useState(() => teacher?.phone ?? '')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [password, setPassword] = useState(() => teacher ? '' : `gs_${Math.random().toString(36).slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`)
  const [showPassword, setShowPassword] = useState(true)
  const [copied, setCopied] = useState(false)

  const [salaryType, setSalaryType] = useState<SalaryType>(() => teacher?.salaryType ?? 'fixed')
  const [rateRaw, setRateRaw] = useState<string>(() => teacher ? String(teacher.rate) : '')

  const { firstName, lastName } = splitFullName(fullName)
  const login = teacher?.login ?? fullName.trim().toLowerCase().replaceAll(' ', '.')

  const numericRate = Number(rateRaw.replaceAll(/\D/g, '')) || 0
  const isCurrency = salaryType === 'fixed' || salaryType === 'per_student'
  const displayRate = isCurrency && numericRate > 0 ? money.format(numericRate) : rateRaw
  const rateHint = isCurrency && numericRate > 0 ? `${money.format(numericRate)} so‘m` : (salaryType === 'percent' && numericRate > 0 ? `${numericRate}%` : null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const digitsOnly = phone.replaceAll(/\D/g, '')
    if (digitsOnly.length !== 12) {
      setPhoneError('Telefon raqami 9 ta raqamdan iborat bo‘lishi kerak (masalan: 90 123 45 67)')
      return
    }

    onSave({
      id: teacher?.id ?? `new-${Date.now()}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      salaryType,
      rate: numericRate,
      kpiBalance: teacher?.kpiBalance ?? 0,
      groups: teacher?.groups ?? [],
      login,
      active: teacher?.active ?? true,
      ...(password && password.trim() ? { password: password.trim() } : {}),
    } as Teacher)
  }

  const handleCopy = () => {
    void navigator.clipboard.writeText(`Login: ${login}\nParol: ${password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="teacher-modal teacher-form-modal" role="dialog" aria-modal="true" aria-labelledby="teacher-form-title">
        <header>
          <div>
            <h2 id="teacher-form-title">{teacher ? 'O‘qituvchini tahrirlash' : 'O‘qituvchi qo‘shish'}</h2>
            <p>Asosiy va to‘lov ma’lumotlarini kiriting</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Yopish" disabled={pending}><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Ism familiya<input name="fullName" required pattern=".*\s+.*" title="Ism va familiyani kiriting" disabled={pending} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Masalan: Alisher Karimov" /></label>
            <label>Telefon<PhoneInput value={phone} disabled={pending} onChange={(val) => { setPhoneError(null); setPhone(val) }} /></label>
            <label>To‘lov turi<select name="salaryType" disabled={pending} value={salaryType} onChange={(e) => setSalaryType(e.target.value as SalaryType)}>{Object.entries(salaryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="money-input-label">
              Stavka
              <input
                name="rateInput"
                type="text"
                inputMode="numeric"
                required
                disabled={pending}
                placeholder={isCurrency ? '3 000 000' : '50'}
                value={displayRate}
                onChange={(e) => {
                  const raw = e.target.value.replaceAll(/\D/g, '')
                  setRateRaw(raw)
                }}
              />
              <input type="hidden" name="rate" value={numericRate} />
              {rateHint ? <small className="form-field-hint">{rateHint}</small> : null}
            </label>
            <div className="form-section-title"><strong>Tizimga kirish</strong><span>{teacher ? 'Login va yangi parol o‘rnatish' : 'Avtomatik login va boshlang‘ich parol'}</span></div>
            <label>Login<input name="login" readOnly value={login} /></label>
            <label><span>{teacher ? 'Yangi parol (ixtiyoriy)' : 'Parol'}</span><div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} readOnly={!teacher} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={teacher ? 'O‘zgartirish uchun kiriting' : ''} /><button type="button" aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko‘rsatish"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
            <button
              type="button"
              className="secondary-button credential-copy-button"
              aria-label="Login va parolni nusxalash"
              disabled={pending || !login || !password}
              onClick={handleCopy}
            >
              {copied ? <Check size={14} style={{ color: '#15803d' }} /> : <Copy size={14} />}
              <span>{copied ? 'Nusxalandi!' : 'Nusxalash'}</span>
            </button>
          </div>

          {phoneError || error ? (
            <p className="form-error" role="alert" style={{ margin: '12px 0 0', color: '#dc2626', fontSize: '12px', fontWeight: 500 }}>
              {phoneError ??
                (error instanceof Error && (error.message.includes('already exists') || error.message.includes('мавжуд') || error.message.includes('CONFLICT') || error.message.includes('Internal'))
                  ? 'Ushbu login yoki telefon raqami allaqachon mavjud'
                  : error instanceof Error
                  ? error.message
                  : 'Ma’lumotlarni saqlab bo‘lmadi. Qayta urinib ko‘ring.')}
            </p>
          ) : null}

          <footer>
            <button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Bekor qilish</button>
            <button type="submit" className="primary-button" disabled={pending}>{pending ? 'Saqlanmoqda...' : 'Saqlash'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function TeachersPage() {
  const teachersQuery = useTeachers()
  const saveMutation = useSaveTeacher()
  const activeMutation = useSetTeacherActive()
  const [searchParams, setSearchParams] = useSearchParams()
  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [salaryType, setSalaryType] = useState<'all' | SalaryType>('all')
  const [selected, setSelected] = useState<Teacher | null>(null)
  const [editing, setEditing] = useState<Teacher | 'new' | null>(null)
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null)

  const handleQueryChange = (val: string) => { setQuery(val); setPage(1) }
  const handleSalaryTypeChange = (val: 'all' | SalaryType) => { setSalaryType(val); setPage(1) }

  function closeForm() {
    setEditing(null)
    saveMutation.reset()
    if (searchParams.get('action')) {
      setSearchParams({}, { replace: true })
    }
  }

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'new') {
      setEditing('new')
    } else if (!action) {
      setEditing(null)
    }
  }, [searchParams])

  const teachers = teachersQuery.data ?? emptyTeachers
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3000)
  }

  const filtered = useMemo(() => teachers.filter((teacher) => {
    if (!teacher.active) return false
    const fullName = `${teacher.firstName} ${teacher.lastName}`.toLowerCase()
    return fullName.includes(query.toLowerCase()) && (salaryType === 'all' || teacher.salaryType === salaryType)
  }), [teachers, query, salaryType])

  const paginatedTeachers = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  async function saveTeacher(value: Teacher) {
    try {
      const isNew = value.id.startsWith('new-')
      const saved = await saveMutation.mutateAsync(value)
      setSelected(saved)
      closeForm()
      showToast(isNew ? 'Yangi o‘qituvchi muvaffaqiyatli qo‘shildi' : 'O‘qituvchi ma’lumotlari muvaffaqiyatli yangilandi')
    } catch {
      // Mutation error caught and rendered inside TeacherForm
    }
  }

  async function deleteTeacher(teacher: Teacher) {
    try {
      await activeMutation.mutateAsync({ id: teacher.id, active: false })
      setDeletingTeacher(null)
      setSelected(null)
      showToast('O‘qituvchi muvaffaqiyatli o‘chirildi')
    } catch {
      // Recoverable mutation error rendered via activeMutation.isError banner
    }
  }

  return <section className="teachers-page">
    <div className="page-heading"><div><h1>O‘qituvchilar</h1><p>O‘qituvchilar, guruhlar va to‘lov shartlarini boshqarish</p></div><Link to="/teachers?action=new" className="page-heading-button"><Plus size={16} /> O‘qituvchi qo‘shish</Link></div>
    
    {activeMutation.isError && !deletingTeacher ? (
      <div className="course-alert-banner" role="alert">
        <AlertCircle size={16} />
        <span>
          {activeMutation.error instanceof Error && activeMutation.error.message.includes('active groups')
            ? 'Faol guruhlari mavjud o‘qituvchini o‘chirib bo‘lmaydi. Avval guruhlarni boshqa o‘qituvchiga biriktiring.'
            : activeMutation.error instanceof Error
            ? activeMutation.error.message
            : 'Faol guruhlari mavjud o‘qituvchini o‘chirib bo‘lmaydi'}
        </span>
      </div>
    ) : null}

    <div className="teachers-layout">
      <article className="panel teachers-registry">
        <div className="teachers-toolbar"><label className="search-field"><Search size={16} /><input aria-label="Qidirish" value={query} onChange={(event) => handleQueryChange(event.target.value)} placeholder="Ism yoki telefon bo‘yicha qidirish" /></label><select aria-label="To‘lov turi" value={salaryType} onChange={(event) => handleSalaryTypeChange(event.target.value as 'all' | SalaryType)}><option value="all">Barcha to‘lov turlari</option>{Object.entries(salaryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {teachersQuery.isPending ? <div className="registry-state">Ma’lumotlar yuklanmoqda...</div> : null}
        {teachersQuery.isError ? <div className="registry-state registry-error">Ma’lumotlarni yuklab bo‘lmadi</div> : null}
        <div className="table-scroll"><table aria-label="O‘qituvchilar ro‘yxati"><thead><tr><th>Ism va familiya</th><th>Telefon</th><th>To‘lov turi</th><th>Guruhlar</th><th>KPI balansi</th><th>Holat</th><th aria-label="Amallar" /></tr></thead><tbody>{paginatedTeachers.map((teacher) => <tr key={teacher.id} onClick={() => setSelected(teacher)} className={selected?.id === teacher.id ? 'selected-row' : ''}><td><strong>{teacher.firstName} {teacher.lastName}</strong><small>@{teacher.login}</small></td><td>{teacher.phone}</td><td>{salaryLabels[teacher.salaryType]}</td><td>{teacher.groups.length ? (teacher.groups.length > 2 ? `${teacher.groups.slice(0, 2).join(', ')}...` : teacher.groups.join(', ')) : '—'}</td><td className="money-cell">{money.format(teacher.kpiBalance)} so‘m</td><td><span className="status status-success">Faol</span></td><td><button type="button" aria-label={`${teacher.firstName} ${teacher.lastName} amallari`} onClick={(event) => { event.stopPropagation(); setSelected(teacher) }}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div>
        <Pagination page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </article>
      {selected ? (
        <>
          <div className="teacher-detail-backdrop" onClick={() => setSelected(null)} />
          <aside className="teacher-detail">
            <header>
              <div>
                <h2>{selected.firstName} {selected.lastName}</h2>
                <span className="status status-success">Faol</span>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Profilni yopish"><X size={18} /></button>
            </header>
            <dl>
              <div><dt>Telefon</dt><dd>{selected.phone}</dd></div>
              <div><dt>Login</dt><dd>{selected.login}</dd></div>
              <div><dt>To‘lov turi</dt><dd>{salaryLabels[selected.salaryType]}</dd></div>
              <div><dt>Stavka</dt><dd>{selected.salaryType === 'percent' ? `${selected.rate}%` : `${money.format(selected.rate)} so‘m`}</dd></div>
              <div><dt>KPI balansi</dt><dd className="detail-balance">{money.format(selected.kpiBalance)} so‘m</dd></div>
            </dl>
            <section>
              <h3>Guruhlar</h3>
              <div className="group-tags">
                {selected.groups.map((group) => (
                  <Link key={group} to={`/groups?search=${group}`} className="group-tag-link">
                    {group}
                  </Link>
                ))}
                {selected.groups.length === 0 ? <span>Guruh biriktirilmagan</span> : null}
              </div>
            </section>
            <footer>
              <button type="button" className="secondary-button" onClick={() => setEditing(selected)}>Tahrirlash</button>
              <button type="button" className="danger-button teacher-detail-delete-btn" onClick={() => setDeletingTeacher(selected)}>
                <Trash2 size={14} />
                <span>O‘chirish</span>
              </button>
            </footer>
          </aside>
        </>
      ) : null}
    </div>
    {editing ? <TeacherForm teacher={editing === 'new' ? undefined : editing} pending={saveMutation.isPending} error={saveMutation.error} onClose={closeForm} onSave={saveTeacher} /> : null}
    {deletingTeacher ? (
      <ConfirmDialog
        title="O‘qituvchini o‘chirish"
        description={`“${deletingTeacher.firstName} ${deletingTeacher.lastName}” o‘qituvchisi o‘chiriladi va ro‘yxatdan olib tashlanadi.`}
        confirmLabel="O‘chirish"
        pending={activeMutation.isPending}
        errorMessage={
          activeMutation.isError
            ? '⛔ Faol guruhlari mavjud o‘qituvchini o‘chirib bo‘lmaydi. Avval guruhlarni boshqa o‘qituvchiga biriktiring.'
            : null
        }
        onCancel={() => {
          setDeletingTeacher(null)
          activeMutation.reset()
        }}
        onConfirm={() => void deleteTeacher(deletingTeacher)}
      />
    ) : null}

    {toast && (
      <div
        role="status"
        style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          color: '#15803d',
          background: '#f0fdf4',
          border: '1px solid rgb(34 197 94 / 30%)',
          borderRadius: '9999px',
          boxShadow: '0 8px 24px rgb(0 0 0 / 12%)',
          fontSize: '13px',
          fontWeight: 500,
          pointerEvents: 'none',
        }}
      >
        <CheckCircle2 size={16} />
        <span>{toast}</span>
      </div>
    )}
  </section>
}
