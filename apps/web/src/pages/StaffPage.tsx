import type { StaffCreateInput, StaffMember, StaffRole, StaffStatus } from '@golden-study/contracts'
import { Archive, Banknote, Check, CheckCircle2, Copy, Eye, EyeOff, Lock, MoreHorizontal, Pencil, Plus, RefreshCw, Search, ShieldCheck, Unlock, X } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { usePayStaffSalary, useSaveStaffMember, useSetStaffStatus, useStaff } from '../features/staff/useStaff'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { PhoneInput, formatDisplayPhone, normalizePhoneWithPrefix } from '../shared/ui/PhoneInput'
import { DateInput, displayToIsoDate } from '../shared/ui/DateInput'
import { Pagination } from '../shared/ui/Pagination'

const emptyStaff: StaffMember[] = []
const roleLabels: Record<StaffRole, string> = {
  superadmin: 'SuperAdmin',
  admin: 'Admin / Menejer',
  teacher: "O'qituvchi",
}
const money = (value: number) => `${new Intl.NumberFormat('uz-UZ').format(value)} UZS`

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}.${month}.${year}` : value
}

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#@!'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function generateLoginFromFullName(fullName: string) {
  const clean = fullName
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}.${parts[parts.length - 1]}`
  }
  if (parts.length === 1 && parts[0]) {
    return parts[0]
  }
  return `staff_${Math.floor(100 + Math.random() * 900)}`
}

function StaffForm({
  member,
  close,
  save,
}: {
  member?: StaffMember
  close: () => void
  save: (input: StaffCreateInput | StaffMember) => void
}) {
  const [fullName, setFullName] = useState(member?.fullName ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRoleState] = useState<StaffRole>(member?.role ?? 'admin')
  const [login, setLogin] = useState(member?.login ?? '')
  const [password, setPassword] = useState(() => (member ? '' : generateRandomPassword()))
  const [copied, setCopied] = useState(false)
  const [salaryRaw, setSalaryRaw] = useState(() => (member?.salaryUzs ? String(member.salaryUzs) : ''))

  const parsedSalary = Number(salaryRaw.replaceAll(/\D/g, ''))
  const formattedSalaryHint = parsedSalary > 0 ? `${new Intl.NumberFormat('uz-UZ').format(parsedSalary)} UZS` : ''

  const handleFullNameChange = (val: string) => {
    setFullName(val)
    if (!member && !login) {
      setLogin(generateLoginFromFullName(val))
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const fullNameVal = String(data.get('fullName')).trim()
    const loginVal = login.trim() || String(data.get('login')).trim()
    const hiredAt = displayToIsoDate(String(data.get('hiredAt'))).trim() || undefined
    const salaryRaw = String(data.get('salaryUzs')).replaceAll(/\D/g, '')
    const salaryUzs = salaryRaw ? Number(salaryRaw) : undefined

    const base = {
      fullName: fullNameVal,
      login: loginVal,
      phone: normalizePhoneWithPrefix(data.get('phone')),
      role,
      status: member?.status ?? 'active',
      hiredAt,
      salaryUzs,
    }

    if (!member) {
      const passVal = String(data.get('password'))
      save({ ...base, password: passVal })
      return
    }

    const passVal = password.trim()
    save({
      ...member,
      ...base,
      status: member?.status ?? 'active',
      linkedTeacherId: member?.linkedTeacherId ?? null,
      linkedTeacherName: member?.linkedTeacherName ?? null,
      lastLoginAt: member?.lastLoginAt ?? null,
      createdAt: member?.createdAt ?? new Date().toISOString().slice(0, 10),
      ...(passVal ? { password: passVal } : {}),
    })
  }

  function copyCredentials() {
    void navigator.clipboard.writeText(`Login: ${login}\nParol: ${password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="teacher-modal teacher-form-modal" role="dialog" aria-modal="true" aria-labelledby="staff-form-title">
        <header>
          <div>
            <h2 id="staff-form-title">{member ? 'Xodimni tahrirlash' : "Xodim qo'shish"}</h2>
            <p>{member ? "Lavozim, rol va aloqa ma'lumotlari" : "Kadroviy ma'lumotlar, login, parol va rol"}</p>
          </div>
          <button type="button" onClick={close} aria-label="Yopish"><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Ism familiya
              <input
                name="fullName"
                required
                value={fullName}
                onChange={(e) => handleFullNameChange(e.target.value)}
                placeholder="Masalan: Alisher Karimov"
              />
            </label>
            <label>Telefon<PhoneInput key={member?.id ?? 'new'} name="phone" defaultValue={member?.phone ?? undefined} required /></label>
            <label>Ishga kirgan sana
              <DateInput name="hiredAt" defaultValue={member?.hiredAt ?? undefined} aria-label="Ishga kirgan sana" />
            </label>
            <label>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Oylik (UZS)</span>
                {formattedSalaryHint ? <span style={{ color: '#15803d', fontWeight: 600, fontSize: '10px' }}>{formattedSalaryHint}</span> : null}
              </span>
              <input
                name="salaryUzs"
                type="text"
                inputMode="numeric"
                placeholder="Masalan: 4 000 000"
                value={salaryRaw ? new Intl.NumberFormat('uz-UZ').format(parsedSalary) : ''}
                onChange={(event) => {
                  const val = event.target.value.replaceAll(/\D/g, '')
                  setSalaryRaw(val)
                }}
              />
            </label>
            <label className="form-wide">Rol
              <select name="role" value={role} onChange={(e) => setRoleState(e.target.value as StaffRole)}>
                {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <div className="form-section-title" style={{ marginTop: '6px' }}>
              <strong>Tizimga kirish huquqi</strong>
              <span>{member ? 'Login va yangi parol o‘rnatish' : 'Avtomatik login va boshlang‘ich parol'}</span>
            </div>

            <label className="form-wide">Login
              <input name="login" required value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Masalan: a.karimov" />
            </label>

            <label className="form-wide">
              <span>{member ? 'Yangi parol (o‘zgartirish uchun kiriting)' : 'Parol'}</span>
              <div className="password-field">
                <input
                  name="password"
                  aria-label="Parol"
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  required={!member}
                  autoComplete="new-password"
                  placeholder={member ? 'O‘zgartirish uchun yangi parol kiriting' : ''}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <button
              type="button"
              className="secondary-button credential-copy-button form-wide"
              aria-label="Login va parolni nusxalash"
              disabled={!login || !password}
              onClick={copyCredentials}
              style={{ gap: '6px' }}
            >
              <Copy size={14} /> <span>{copied ? 'Nusxalandi!' : 'Nusxalash'}</span>
            </button>
          </div>
          <footer>
            <button type="button" className="secondary-button" onClick={close}>Bekor qilish</button>
            <button type="submit" className="primary-button">Saqlash</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

const statusLabels: Record<StaffStatus, string> = { active: 'Faol', blocked: 'Bloklangan', archived: 'Arxivlangan' }

export function StaffPage() {
  const staffQuery = useStaff()
  const saveMutation = useSaveStaffMember()
  const statusMutation = useSetStaffStatus()
  const payoutMutation = usePayStaffSalary()

  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<'all' | StaffRole>('all')
  const [status, setStatus] = useState<'all' | StaffStatus>('active')
  const [selected, setSelected] = useState<StaffMember | null>(null)
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null)
  const [payoutStaff, setPayoutStaff] = useState<StaffMember | null>(null)
  const [payoutFeedback, setPayoutFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3000)
  }

  const handleQueryChange = (val: string) => { setQuery(val); setPage(1) }
  const handleRoleChange = (val: 'all' | StaffRole) => { setRole(val); setPage(1) }
  const handleStatusChange = (val: 'all' | StaffStatus) => { setStatus(val); setPage(1) }

  const staff = staffQuery.data ?? emptyStaff

  const filtered = useMemo(() => staff.filter((member) => {
    const haystack = `${member.fullName} ${member.login} ${member.phone ?? ''} ${member.position ?? ''}`.toLowerCase()
    const matchesQuery = haystack.includes(query.toLowerCase())
    const matchesRole = role === 'all' || member.role === role
    const matchesStatus = status === 'all' || member.status === status

    return matchesQuery && matchesRole && matchesStatus
  }), [query, role, staff, status])

  const paginatedStaff = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  const stats = useMemo(() => ({
    active: staff.filter((member) => member.status === 'active').length,
    archived: staff.filter((member) => member.status === 'archived').length,
    blocked: staff.filter((member) => member.status === 'blocked').length,
  }), [staff])

  async function saveMember(input: StaffCreateInput | StaffMember) {
    try {
      const isEdit = 'id' in input && input.id
      const saved = await saveMutation.mutateAsync(input)
      setSelected(saved)
      setEditing(null)
      setQuery('')
      setRole('all')
      setStatus('active')
      showToast(isEdit ? 'Xodim ma’lumotlari muvaffaqiyatli saqlandi' : 'Yangi xodim muvaffaqiyatli qo‘shildi')
    } catch (err: any) {
      console.error('Failed to save staff member:', err)
    }
  }

  async function changeStatus(member: StaffMember, targetStatus: StaffStatus) {
    const updated = await statusMutation.mutateAsync({ id: member.id, status: targetStatus })
    setSelected(updated)
    showToast('Xodim holati muvaffaqiyatli o‘zgartirildi')
  }

function isPaidThisMonth(lastSalaryPaidAt?: string | null): boolean {
  if (!lastSalaryPaidAt) return false
  const paidDate = new Date(lastSalaryPaidAt)
  const now = new Date()
  return paidDate.getFullYear() === now.getFullYear() && paidDate.getMonth() === now.getMonth()
}

  async function confirmPayout() {
    if (!payoutStaff || payoutMutation.isPending) return
    const targetStaff = payoutStaff
    const amount = targetStaff.salaryUzs && targetStaff.salaryUzs > 0 ? targetStaff.salaryUzs : 1_000_000
    try {
      setPayoutFeedback(null)
      const updated = await payoutMutation.mutateAsync({
        id: targetStaff.id,
        amount,
        comment: targetStaff.position ? `Oylik: ${targetStaff.position}` : 'Xodim ish haqi',
      })
      if (updated) {
        setSelected(updated)
      }
      setPayoutFeedback({
        type: 'success',
        text: `✓ ${targetStaff.fullName} uchun ${new Intl.NumberFormat('uz-UZ').format(amount)} UZS oylik berildi va Moliyaga o'tkazildi`,
      })
      setPayoutStaff(null)
    } catch (err: any) {
      setPayoutFeedback({
        type: 'error',
        text: `⚠️ Oylik berishda xatolik yuz berdi: ${err?.message || "Kutilmagan xato"}`,
      })
    }
  }

  return (
    <section className="staff-page">
      <div className="page-heading">
        <div>
          <h1>Xodimlar</h1>
          <p>Kadroviy hisob, rollar, CRM huquqlari va oylik ма’lumotlari</p>
        </div>
        <button type="button" onClick={() => setEditing('new')}>
          <Plus size={16} /> Xodim qo'shish
        </button>
      </div>

      <div className="staff-summary staff-summary-tabs">
        <article
          className={`summary-card-tab ${status === 'active' ? 'active-summary-tab tab-active' : ''}`}
          onClick={() => handleStatusChange('active')}
          role="button"
          tabIndex={0}
          title="Faol xodimlarni ko'rish"
        >
          <span className="icon-success"><ShieldCheck size={18} /></span>
          <div>
            <p>Faol xodimlar</p>
            <strong>{stats.active}</strong>
          </div>
        </article>

        <article
          className={`summary-card-tab ${status === 'archived' ? 'active-summary-tab tab-archived' : ''}`}
          onClick={() => handleStatusChange('archived')}
          role="button"
          tabIndex={0}
          title="Arxivlangan xodimlarni ko'rish"
        >
          <span className="icon-muted"><Archive size={18} /></span>
          <div>
            <p>Arxivdagilar</p>
            <strong>{stats.archived}</strong>
          </div>
        </article>

        <article
          className={`summary-card-tab ${status === 'blocked' ? 'active-summary-tab tab-blocked' : ''}`}
          onClick={() => handleStatusChange('blocked')}
          role="button"
          tabIndex={0}
          title="Bloklangan xodimlarni ko'rish"
        >
          <span className="icon-danger"><Lock size={18} /></span>
          <div>
            <p>Bloklanganlar</p>
            <strong>{stats.blocked}</strong>
          </div>
        </article>
      </div>

      {payoutFeedback && (
        <div
          className={`payout-feedback-banner ${payoutFeedback.type === 'success' ? 'status-success' : 'status-danger'}`}
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: payoutFeedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${payoutFeedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: payoutFeedback.type === 'success' ? '#166534' : '#991b1b',
            fontWeight: 500,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{payoutFeedback.text}</span>
          <button
            type="button"
            onClick={() => setPayoutFeedback(null)}
            aria-label="Xabarni yopish"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'inline-flex' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="teachers-layout">
        <article className="panel teachers-registry">
          <div className="staff-toolbar">
            <label className="search-field">
              <Search size={16} />
              <input
                aria-label="Xodim qidirish"
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder="Ism, lavozim, login yoki telefon"
              />
            </label>
            <select aria-label="Rol" value={role} onChange={(event) => handleRoleChange(event.target.value as 'all' | StaffRole)}>
              <option value="all">Barcha rollar</option>
              {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select aria-label="Holat" value={status} onChange={(event) => handleStatusChange(event.target.value as 'all' | StaffStatus)}>
              <option value="active">Faol</option>
              <option value="blocked">Bloklangan</option>
              <option value="archived">Arxivlangan (O'chirilgan)</option>
              <option value="all">Barcha holatlar</option>
            </select>
          </div>
          {staffQuery.isPending && <div className="registry-state">Xodimlar yuklanmoqda...</div>}
          {staffQuery.isError && <div className="registry-state registry-error">Xodimlar yuklanmadi</div>}
          <div className="table-scroll">
            <table aria-label="Xodimlar ro'yxati">
              <thead>
                <tr>
                  <th>Xodim</th>
                  <th>Telefon</th>
                  <th>Rol</th>
                  <th>Holat</th>
                  <th>Oylik</th>
                  <th aria-label="Amallar" />
                </tr>
              </thead>
              <tbody>
                {paginatedStaff.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => setSelected(member)}
                    className={selected?.id === member.id ? 'selected-row' : ''}
                  >
                    <td data-label="Xodim">
                      <strong>{member.fullName}</strong>
                      <small>@{member.login}</small>
                    </td>
                    <td data-label="Telefon">{formatDisplayPhone(member.phone) || '—'}</td>
                    <td data-label="Rol">{roleLabels[member.role]}</td>
                    <td data-label="Holat">
                      <span className={`status ${member.status === 'active' ? 'status-success' : member.status === 'blocked' ? 'status-danger' : 'status-muted'}`}>
                        {statusLabels[member.status]}
                      </span>
                    </td>
                    <td data-label="Oylik">{member.salaryUzs ? <strong className="credit">{money(member.salaryUzs)}</strong> : '—'}</td>
                    <td data-label="Amallar">
                      <button
                        type="button"
                        aria-label={`${member.fullName} amallari`}
                        onClick={(event) => { event.stopPropagation(); setSelected(member) }}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </article>

        {editing && (
          <StaffForm member={editing === 'new' ? undefined : editing} close={() => setEditing(null)} save={saveMember} />
        )}

        {selected && !editing && (
          <>
            <button type="button" className="staff-right-drawer-backdrop" aria-label="Profil fonini yopish" onClick={() => setSelected(null)} />
            <aside className="staff-right-drawer">
              <header className="staff-drawer-header">
                <div className="staff-drawer-title-group">
                  <h2>{selected.fullName}</h2>
                  <span className={`status ${selected.status === 'active' ? 'status-success' : selected.status === 'blocked' ? 'status-danger' : 'status-muted'}`}>
                    {statusLabels[selected.status]}
                  </span>
                </div>
                <div className="staff-drawer-header-actions">
                  {selected.status !== 'archived' && (
                    <button
                      type="button"
                      className="drawer-header-archive-btn"
                      title="Xodimni arxivlash (Arxivlash)"
                      aria-label="Arxivlash"
                      onClick={() => changeStatus(selected, 'archived')}
                    >
                      <Archive size={14} />
                      <span>Arxivlash</span>
                    </button>
                  )}
                  {selected.status === 'archived' && (
                    <button
                      type="button"
                      className="drawer-header-archive-btn drawer-icon-success"
                      title="Arxivdan tiklash (Восстановить)"
                      aria-label="Arxivdan tiklash"
                      onClick={() => changeStatus(selected, 'active')}
                    >
                      <RefreshCw size={14} />
                      <span>Tiklash</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="drawer-close-btn"
                    onClick={() => setSelected(null)}
                    aria-label="Profilni yopish"
                    title="Yopish (✕)"
                  >
                    <X size={18} />
                  </button>
                </div>
              </header>
              {payoutFeedback && (
                <div
                  className={`payout-feedback-banner ${payoutFeedback.type === 'success' ? 'status-success' : 'status-danger'}`}
                  style={{
                    margin: '12px 16px 0 16px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: payoutFeedback.type === 'success' ? '#edfcf2' : '#fef2f2',
                    border: `1px solid ${payoutFeedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    color: payoutFeedback.type === 'success' ? '#15803d' : '#991b1b',
                    fontWeight: 600,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  }}
                >
                  <span>{payoutFeedback.text}</span>
                  <button
                    type="button"
                    onClick={() => setPayoutFeedback(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px', flexShrink: 0 }}
                    aria-label="Yopish"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <dl>
                <div><dt>Login</dt><dd>@{selected.login}</dd></div>
                <div><dt>Telefon</dt><dd>{formatDisplayPhone(selected.phone) || '—'}</dd></div>
                <div><dt>Rol</dt><dd>{roleLabels[selected.role]}</dd></div>
                <div><dt>Ishga kirgan</dt><dd>{formatDate(selected.hiredAt)}</dd></div>
                <div><dt>Oylik</dt><dd>{selected.salaryUzs ? <strong className="credit">{money(selected.salaryUzs)}</strong> : '—'}</dd></div>
                <div><dt>Oxirgi oylik</dt><dd>{formatDate(selected.lastSalaryPaidAt)}</dd></div>
                <div>
                  <dt>Oylik holati</dt>
                  <dd>
                    {isPaidThisMonth(selected.lastSalaryPaidAt) ? (
                      <span className="status status-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} /> Ushbu oyda to‘langan
                      </span>
                    ) : (
                      <span className="status status-muted">Oylik to‘lanmagan</span>
                    )}
                  </dd>
                </div>
                <div><dt>Oxirgi kirish</dt><dd>{formatDate(selected.lastLoginAt)}</dd></div>
              </dl>
              <section>
                <h3>Huquqlar va Boshqaruv</h3>
                <div className="group-tags">
                  <span>{selected.role === 'admin' || selected.role === 'superadmin' ? 'To‘liq admin access' : 'Cheklangan CRM access'}</span>
                  <span>{selected.linkedTeacherId ? 'Teacher profil sync' : 'Shtat xodimi'}</span>
                </div>
              </section>
              <footer className="staff-drawer-footer">
                {selected.status !== 'archived' && (
                  <div className="staff-drawer-actions-stack">
                    <button
                      type="button"
                      className="primary-button staff-action-payout"
                      onClick={() => setPayoutStaff(selected)}
                    >
                      <Banknote size={15} /> Oylik berish
                    </button>
                    <div className="staff-drawer-sub-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setEditing(selected)}
                      >
                        <Pencil size={15} />
                        <span>Tahrirlash</span>
                      </button>
                      <button
                        type="button"
                        className={`secondary-button ${selected.status === 'active' ? 'danger-ghost-button' : 'success-ghost-button'}`}
                        aria-label={selected.status === 'active' ? 'Bloklash' : 'Faollashtirish'}
                        onClick={() => changeStatus(selected, selected.status === 'active' ? 'blocked' : 'active')}
                      >
                        {selected.status === 'active' ? <Lock size={15} /> : <Unlock size={15} />}
                        <span>{selected.status === 'active' ? 'Bloklash' : 'Faollashtirish'}</span>
                      </button>
                    </div>
                  </div>
                )}
                {selected.status === 'archived' && (
                  <button
                    type="button"
                    className="primary-button"
                    style={{ width: '100%' }}
                    onClick={() => changeStatus(selected, 'active')}
                  >
                    <RefreshCw size={15} /> Tiklash (Восстановить)
                  </button>
                )}
              </footer>
            </aside>
          </>
        )}
      </div>

      {payoutStaff && (() => {
        const alreadyPaid = isPaidThisMonth(payoutStaff.lastSalaryPaidAt)
        const payoutAmount = payoutStaff.salaryUzs && payoutStaff.salaryUzs > 0 ? payoutStaff.salaryUzs : 1_000_000
        return (
          <ConfirmDialog
            title={alreadyPaid ? "⚠️ Oylik allaqachon berilgan" : "Xodim ish haqini berish"}
            description={
              alreadyPaid
                ? `⚠️ Diqqat: ${payoutStaff.fullName} uchun ushbu oyda (${formatDate(payoutStaff.lastSalaryPaidAt)}) allaqachon oylik berilgan! Qayta oylik berishni tasdiqlaysizmi? ${money(payoutAmount)} Moliya (Chiqim) "Xodimlar ish haqi" kategoriyasiga yoziladi.`
                : `${payoutStaff.fullName} uchun ${money(payoutAmount)} ish haqi beriladi va Moliya (Chiqim) "Xodimlar ish haqi" kategoriyasiga yoziladi.`
            }
            confirmLabel={alreadyPaid ? "Ha, qayta berish" : "Oylikni berish"}
            variant={alreadyPaid ? "danger" : "primary"}
            pending={payoutMutation.isPending}
            onCancel={() => setPayoutStaff(null)}
            onConfirm={confirmPayout}
          />
        )
      })()}

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
  )
}
