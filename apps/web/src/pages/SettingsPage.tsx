import type { CenterSettings } from '@golden-study/contracts'
import { Check, KeyRound, Palette, Save, Settings, Trash2, User } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { type ColorPalette } from '../features/appearance/appearance'
import { useAppearance } from '../features/appearance/appearanceContext'
import { useSaveSettings, useSettings } from '../features/settings/useSettings'
import { changePassword, getSession } from '../features/auth/auth.service'
import { formatApiError } from '../shared/api/errorTranslation'
import { useDashboard } from '../features/dashboard/useDashboard'
import { useTeacherDashboard } from '../features/teacher-dashboard/useTeacherDashboard'
import { useFinance } from '../features/finance/useFinance'
import { PasswordInput } from '../shared/ui/PasswordInput'

function makeDraft(settings: CenterSettings): CenterSettings {
  return { ...settings }
}

const paletteOptions: { value: ColorPalette; label: string }[] = [
  { value: 'golden', label: 'Golden' },
  { value: 'ocean', label: 'Ocean' },
]

function PaletteSelector() {
  const { palette, setPalette } = useAppearance()

  return (
    <section className="panel settings-palette-panel" aria-labelledby="settings-palette-title">
      <header>
        <span><Palette size={16} /></span>
        <div><h2 id="settings-palette-title">Interfeys rangi</h2><p>O‘zingizga qulay rangni tanlang</p></div>
      </header>
      <div className="settings-palette-options">
        {paletteOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`settings-palette-option settings-palette-option--${option.value}`}
            aria-label={`${option.label} rang palitrasi`}
            aria-pressed={palette === option.value}
            onClick={() => setPalette(option.value)}
          >
            <span className="settings-palette-preview" aria-hidden="true"><i /><i /><i /></span>
            <strong>{option.label}</strong>
            {palette === option.value ? <Check className="settings-palette-check" size={15} /> : null}
          </button>
        ))}
      </div>
    </section>
  )
}

export function SettingsPage() {
  const user = getSession()!
  const isTeacher = user?.role === 'teacher'
  const profileStorageKey = isTeacher ? 'golden-study-teacher-profile' : 'golden-study-admin-profile'

  // Admin settings states
  const settingsQuery = useSettings({ enabled: !isTeacher })
  const saveMutation = useSaveSettings()
  const [draft, setDraft] = useState<CenterSettings | null>(null)
  const [logoError, setLogoError] = useState('')
  const teacherDashboardQuery = useTeacherDashboard({ enabled: isTeacher })
  const adminDashboardQuery = useDashboard({ enabled: !isTeacher })
  const financeQuery = useFinance({ enabled: !isTeacher })

  // Teacher settings states
  const [profile, setProfile] = useState(() => {
    const saved = window.localStorage.getItem(profileStorageKey)
    return saved ? JSON.parse(saved) : {
      name: user?.name || 'Alisher Karimov',
      specialization: 'IELTS Instructor',
      phone: '+998 (90) 123-45-67',
      avatarUrl: ''
    }
  })
  const [lang, setLang] = useState(() => window.localStorage.getItem('golden-study-lang') || 'uz')
  const [passwordDraft, setPasswordDraft] = useState({
    current: '',
    newPass: '',
    confirm: ''
  })
  const [profileSaved, setProfileSaved] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    if (!isTeacher && settingsQuery.data) {
      setDraft(makeDraft(settingsQuery.data))
    }
  }, [settingsQuery.data, isTeacher])

  // Admin Save handler
  async function submitAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    const saved = await saveMutation.mutateAsync(draft)
    setDraft(makeDraft(saved))
  }

  function uploadLogo(file: File | undefined) {
    if (!file || !draft) return
    setLogoError('')
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setLogoError('Faqat PNG yoki JPG fayl yuklash mumkin')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Logo hajmi 5 MB dan oshmasligi kerak')
      return
    }
    if (draft.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(draft.logoUrl)
    const logoUrl = URL.createObjectURL(file)
    setDraft({ ...draft, logoUrl })
  }

  function removeLogo() {
    if (!draft) return
    if (draft.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(draft.logoUrl)
    setLogoError('')
    setDraft({ ...draft, logoUrl: null })
  }

  // Teacher handlers
  function saveTeacherProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    window.localStorage.setItem(profileStorageKey, JSON.stringify(profile))
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 3000)
  }

  async function saveTeacherPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError('')
    setPasswordSaved(false)

    if (passwordDraft.newPass !== passwordDraft.confirm) {
      setPasswordError('Yangi parollar mos kelmadi')
      return
    }
    if (passwordDraft.newPass.length < 6) {
      setPasswordError("Parol kamida 6 ta belgidan iborat bo'lishi kerak")
      return
    }

    try {
      setIsChangingPassword(true)
      await changePassword({
        currentPassword: passwordDraft.current,
        newPassword: passwordDraft.newPass,
      })
      setPasswordSaved(true)
      setPasswordDraft({ current: '', newPass: '', confirm: '' })
      setTimeout(() => setPasswordSaved(false), 3000)
    } catch (err) {
      setPasswordError(formatApiError(err, 'Parolni yangilashda xatolik yuz berdi'))
    } finally {
      setIsChangingPassword(false)
    }
  }

  function cycleLanguage() {
    const languages = ['uz', 'ru', 'en']
    const nextLang = languages[(languages.indexOf(lang) + 1) % languages.length]
    setLang(nextLang)
    window.localStorage.setItem('golden-study-lang', nextLang)
  }



  const initials = isTeacher
    ? profile.name.split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase() || 'T'
    : draft?.centerName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'GS'
  const adminHasChanges = Boolean(draft && settingsQuery.data && (
    draft.centerName.trim() !== settingsQuery.data.centerName || draft.logoUrl !== settingsQuery.data.logoUrl
  ))

  if (isTeacher) {
    return (
      <section className="settings-page">
        <div className="page-heading">
          <div>
            <h1>Sozlamalar</h1>
            <p>Shaxsiy ma'lumotlar va xavfsizlik sozlamalari</p>
          </div>
        </div>

        <div className="settings-layout">
          <div style={{ display: 'grid', gap: '14px' }}>
            <PaletteSelector />
            {/* Profile Form */}
            <form className="panel settings-form" onSubmit={saveTeacherProfile}>
              <header>
                <span><User size={16} /></span>
                <div>
                  <h2>Shaxsiy ma'lumotlar</h2>
                  <p>F.I.Sh va bog'lanish ma'lumotlari</p>
                </div>
                <button type="button" className="settings-language-button" onClick={cycleLanguage} aria-label="Interfeys tilini o‘zgartirish" title="Interfeys tilini o‘zgartirish">{lang.toUpperCase()}</button>
              </header>

              <div className="settings-grid">
                <label className="form-wide">
                  F.I.Sh. (To'liq ism)
                  <input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required />
                </label>
                <label>
                  Mutaxassislik
                  <input value={profile.specialization} onChange={(event) => setProfile({ ...profile, specialization: event.target.value })} required />
                </label>
                <label>
                  Telefon raqami
                  <input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} required />
                </label>
              </div>

              <footer>
                {profileSaved && <span className="save-success-badge" style={{ marginRight: '8px' }}>Saqlandi!</span>}
                <button type="submit" className="primary-button">
                  <Save size={16} /> Saqlash
                </button>
              </footer>
            </form>

            {/* Password Change Form */}
            <form className="panel settings-form" onSubmit={saveTeacherPassword}>
              <header>
                <span><KeyRound size={16} /></span>
                <div>
                  <h2>Xavfsizlik</h2>
                  <p>Tizimga kirish parolini o'zgartirish</p>
                </div>
              </header>

              <div className="settings-grid">
                <label className="form-wide">
                  Hozirgi parol
                  <PasswordInput aria-label="Hozirgi parol" value={passwordDraft.current} onChange={(event) => setPasswordDraft({ ...passwordDraft, current: event.target.value })} required />
                </label>
                <label>
                  Yangi parol
                  <PasswordInput aria-label="Yangi parol" value={passwordDraft.newPass} onChange={(event) => setPasswordDraft({ ...passwordDraft, newPass: event.target.value })} required />
                </label>
                <label>
                  Yangi parolni tasdiqlash
                  <PasswordInput aria-label="Yangi parolni tasdiqlash" value={passwordDraft.confirm} onChange={(event) => setPasswordDraft({ ...passwordDraft, confirm: event.target.value })} required />
                </label>
              </div>

              {passwordError && <div style={{ color: '#b91c1c', fontSize: '11px', padding: '0 18px', fontWeight: 500 }}>{passwordError}</div>}

              <footer>
                {passwordSaved && <span className="save-success-badge" style={{ marginRight: '8px' }}>Parol yangilandi!</span>}
                <button type="submit" className="primary-button" disabled={isChangingPassword}>
                  <Save size={16} /> {isChangingPassword ? 'Saqlanmoqda...' : 'Parolni yangilash'}
                </button>
              </footer>
            </form>


          </div>

          {/* Sidebar Preview */}
          <aside className="settings-preview">
            <article className="panel teacher-profile-card">
              <header>
                <span><User size={16} /></span>
                <h2>Profil kartasi</h2>
              </header>
              <div className="settings-logo-preview settings-avatar-preview" aria-label="Avatar preview">
                {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <strong>{initials}</strong>}
              </div>
              <h3 style={{ margin: '10px 0 2px', textAlign: 'center', fontSize: '14px' }}>{profile.name}</h3>
              <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: '11px', textAlign: 'center' }}>{profile.specialization}</p>

              {teacherDashboardQuery.data && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  padding: '12px 6px 0',
                  marginTop: '12px',
                  borderTop: '1px solid var(--border)',
                  fontSize: '11px',
                  color: 'var(--muted)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <strong style={{ display: 'block', color: 'var(--text)', fontSize: '13px' }}>
                      {teacherDashboardQuery.data.activeGroups}
                    </strong>
                    Guruhlar
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <strong style={{ display: 'block', color: 'var(--text)', fontSize: '13px' }}>
                      {teacherDashboardQuery.data.activeStudents}
                    </strong>
                    O'quvchilar
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <strong style={{ display: 'block', color: 'var(--text)', fontSize: '13px' }}>
                      {teacherDashboardQuery.data.attendancePercent}%
                    </strong>
                    Davomat
                  </div>
                </div>
              )}
            </article>
          </aside>
        </div>
      </section>
    )
  }

  // Admin settings render
  return (
    <section className="settings-page">
      <div className="page-heading">
        <div>
          <h1>Sozlamalar</h1>
          <p>Shaxsiy, xavfsizlik va markaz sozlamalari</p>
        </div>
      </div>

      {settingsQuery.isPending && <div className="registry-state">Sozlamalar yuklanmoqda...</div>}
      {settingsQuery.isError && <div className="registry-state registry-error">Sozlamalar yuklanmadi</div>}

      {draft && (
        <div className="settings-layout">
          <div className="settings-forms">
          <PaletteSelector />
          <form className="panel settings-form" onSubmit={submitAdmin}>
            <header>
              <span><Settings size={16} /></span>
              <button type="button" className="settings-language-button" onClick={cycleLanguage} aria-label="Interfeys tilini o‘zgartirish" title="Interfeys tilini o‘zgartirish">{lang.toUpperCase()}</button>
            </header>

            <div className="settings-grid">
              <label className="form-wide">
                Tizim nomi
                <input value={draft.centerName} onChange={(event) => setDraft({ ...draft, centerName: event.target.value })} required />
              </label>
            </div>

            <footer>
              {saveMutation.isSuccess && <span className="save-success-badge" style={{ marginRight: '8px' }}>Saqlandi!</span>}
              <button type="submit" className="primary-button" disabled={saveMutation.isPending || !adminHasChanges}>
                <Save size={16} /> {saveMutation.isPending ? 'Saqlanmoqda...' : 'Markazni saqlash'}
              </button>
            </footer>
          </form>

          <form className="panel settings-form" onSubmit={saveTeacherProfile}>
            <header>
              <span><User size={16} /></span>
              <div><h2>Shaxsiy ma’lumotlar</h2><p>F.I.Sh va bog‘lanish ma’lumotlari</p></div>
            </header>
            <div className="settings-grid">
              <label className="form-wide">F.I.Sh. (To‘liq ism)<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label>
              <label className="form-wide">Telefon raqami<input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} required /></label>
            </div>
            <footer>{profileSaved && <span className="save-success-badge" style={{ marginRight: '8px' }}>Saqlandi!</span>}<button type="submit" className="primary-button"><Save size={16} /> Shaxsiy ma’lumotlarni saqlash</button></footer>
          </form>

          <form className="panel settings-form" onSubmit={saveTeacherPassword}>
            <header>
              <span><KeyRound size={16} /></span>
              <div><h2>Xavfsizlik</h2><p>Tizimga kirish parolini o‘zgartirish</p></div>
            </header>
            <div className="settings-grid">
              <label className="form-wide">Hozirgi parol<PasswordInput aria-label="Hozirgi parol" value={passwordDraft.current} onChange={(event) => setPasswordDraft({ ...passwordDraft, current: event.target.value })} required /></label>
              <label>Yangi parol<PasswordInput aria-label="Yangi parol" value={passwordDraft.newPass} onChange={(event) => setPasswordDraft({ ...passwordDraft, newPass: event.target.value })} required /></label>
              <label>Yangi parolni tasdiqlash<PasswordInput aria-label="Yangi parolni tasdiqlash" value={passwordDraft.confirm} onChange={(event) => setPasswordDraft({ ...passwordDraft, confirm: event.target.value })} required /></label>
            </div>
            {passwordError && <div className="settings-password-error" role="alert">{passwordError}</div>}
            <footer>{passwordSaved && <span className="save-success-badge" style={{ marginRight: '8px' }}>Parol yangilandi!</span>}<button type="submit" className="primary-button" disabled={isChangingPassword}><Save size={16} /> {isChangingPassword ? 'Saqlanmoqda...' : 'Parolni yangilash'}</button></footer>
          </form>
          </div>

          <aside className="settings-preview">
            <article className="panel">
              <div className="settings-logo-control">
                <label className="settings-logo-preview" title="Logo yuklash">
                  {draft.logoUrl ? <img src={draft.logoUrl} alt="Markaz logotipi" /> : <strong>{initials}</strong>}
                  <input aria-label="Logo yuklash" type="file" accept="image/png,image/jpeg" onChange={(event) => {
                    uploadLogo(event.currentTarget.files?.[0])
                    event.currentTarget.value = ''
                  }} />
                </label>
                {draft.logoUrl && <button type="button" className="settings-logo-remove" aria-label="Logoni o‘chirish" title="Logoni o‘chirish" onClick={removeLogo}><Trash2 size={14} /></button>}
              </div>
              <h3>{draft.centerName}</h3>
              {adminDashboardQuery.data && (
                <div className="settings-admin-stats" aria-label="Super admin ko‘rsatkichlari">
                  <div className="settings-study-stats">
                    {adminDashboardQuery.data.stats.slice(0, 3).map((item, idx) => (
                      <span key={idx}><strong>{item.value}</strong>{item.label}</span>
                    ))}
                  </div>
                  {financeQuery.data && <div className="settings-finance-stats">
                    <span><small>Oxirgi oy foydasi</small><strong>{new Intl.NumberFormat('uz-UZ').format(financeQuery.data.summary.profit)} UZS</strong></span>
                    <span><small>Oxirgi oy xarajati</small><strong>{new Intl.NumberFormat('uz-UZ').format(financeQuery.data.summary.expense)} UZS</strong></span>
                  </div>}
                </div>
              )}
              {logoError && <p className="settings-upload-error" role="alert">{logoError}</p>}
            </article>
          </aside>
        </div>
      )}
    </section>
  )
}
