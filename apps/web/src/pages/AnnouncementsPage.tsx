import type { Announcement, AnnouncementTargetType } from '@golden-study/contracts'
import { Megaphone, Plus, Search, Send, X } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { getSession } from '../features/auth/auth.service'
import { useAnnouncements, useSendAnnouncement } from '../features/announcements/useAnnouncements'
import { useCourses } from '../features/courses/useCourses'
import { useGroups } from '../features/groups/useGroups'

const empty: Announcement[] = []

function statusLabel(status: Announcement['deliveryStatus']) {
  if (status === 'BOT_DELIVERED') return 'Yetkazildi'
  if (status === 'scheduled') return 'Rejalangan'
  if (status === 'queued') return 'Navbatda'
  if (status === 'failed') return 'Xato'
  return 'Qoralama'
}

function formatDate(value: string | null) {
  if (!value || isNaN(Date.parse(value))) return '-'
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Tashkent',
    }).formatToParts(new Date(value))
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
    return `${get('day')}.${get('month')}.${get('year')}`
  } catch {
    return String(value)
  }
}

function AnnouncementForm({ close, send }: { close: () => void; send: (announcement: Announcement) => Promise<void> | void }) {
  const groupsQuery = useGroups()
  const coursesQuery = useCourses()
  const groups = groupsQuery.data ?? []
  const courses = coursesQuery.data ?? []
  const [targetType, setTargetType] = useState<AnnouncementTargetType>('all')
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const targetId = targetType === 'all' ? null : String(data.get('targetId'))
    const targetName = targetType === 'all'
      ? 'Barcha ota-onalar'
      : targetType === 'group'
        ? groups.find((group) => group.id === targetId)?.name ?? ''
        : courses.find((course) => course.id === targetId)?.title ?? ''
    const scheduledValue = String(data.get('scheduledAt') ?? '')
    const announcement = {
      id: `a-${Date.now()}`,
      targetType,
      targetId,
      targetName,
      title: String(data.get('title')),
      body: String(data.get('body')),
      deliveryStatus: scheduleMode === 'scheduled' ? ('scheduled' as const) : ('queued' as const),
      createdAt: new Date().toISOString(),
      scheduledAt: scheduleMode === 'scheduled' ? (scheduledValue && !isNaN(Date.parse(scheduledValue)) ? new Date(scheduledValue).toISOString() : new Date().toISOString()) : null,
      deliveredAt: null,
    }
    await send(announcement)
  }

  return (
    <div className="modal-backdrop">
      <section className="teacher-modal group-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>E’lon yuborish</h2>
            <p>Xabar backend bosqichida BullMQ navbatiga qo‘yiladi</p>
          </div>
          <button type="button" onClick={close} aria-label="Yopish"><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Kimga<select name="targetType" value={targetType} onChange={(event) => setTargetType(event.target.value as AnnouncementTargetType)}><option value="all">Barcha ota-onalar</option><option value="group">Guruh</option><option value="course">Kurs</option></select></label>
            {targetType !== 'all' && (
              <label>{targetType === 'group' ? 'Guruh' : 'Kurs'}<select name="targetId" required>{(targetType === 'group' ? groups : courses).map((item) => <option key={item.id} value={item.id}>{'name' in item ? item.name : item.title}</option>)}</select></label>
            )}
            <label>Yuborish vaqti<select value={scheduleMode} onChange={(event) => setScheduleMode(event.target.value as 'now' | 'scheduled')}><option value="now">Hozir yuborish</option><option value="scheduled">Vaqt belgilash</option></select></label>
            {scheduleMode === 'scheduled' && <label>Rejalangan vaqt<input name="scheduledAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} /></label>}
            <label className="form-wide">Sarlavha<input name="title" required placeholder="Masalan: Dars jadvali o‘zgarishi" /></label>
            <label className="form-wide">Matn<textarea name="body" required placeholder="E’lon matnini kiriting" /></label>
          </div>
          <footer>
            <button className="secondary-button" type="button" onClick={close}>Bekor</button>
            <button className="primary-button" type="submit"><Send size={14} /> Yuborish</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function AnnouncementsPage() {
  const user = getSession()
  const isAdmin = user?.role === 'admin'
  const query = useAnnouncements()
  const sendMutation = useSendAnnouncement()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const announcements = query.data ?? empty
  const filtered = useMemo(() => announcements.filter((item) => `${item.title} ${item.body} ${item.targetName}`.toLowerCase().includes(search.toLowerCase())), [announcements, search])

  async function send(announcement: Announcement) {
    try {
      await sendMutation.mutateAsync(announcement)
    } catch (err) {
      console.error('SEND MUTATION ERROR:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="announcements-page">
      <div className="page-heading">
        <div>
          <h1>E’lonlar</h1>
          <p>Ota-onalarga Telegram orqali yuboriladigan xabarlar jurnali</p>
        </div>
        {isAdmin && <button type="button" onClick={() => setCreating(true)}><Plus size={16} /> E’lon yuborish</button>}
      </div>

      <div className="course-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input aria-label="E’lon qidirish" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Sarlavha, matn yoki target" />
        </label>
      </div>

      {query.isPending && <div className="dashboard-state">E’lonlar yuklanmoqda...</div>}
      {query.isError && <div className="dashboard-state dashboard-error">E’lonlar yuklanmadi</div>}
      {creating && <AnnouncementForm close={() => setCreating(false)} send={send} />}

      <div className="announcements-layout">
        <section className="panel announcements-list">
          <header><h2>Yuborilgan e’lonlar</h2><span className="finance-note">{filtered.length} ta yozuv</span></header>
          <div>
            {filtered.map((item) => (
              <article key={item.id} className="announcement-card">
                <header className="announcement-card-header">
                  <span className="announcement-card-icon"><Megaphone size={15} /></span>
                  <div className="announcement-card-content"><h3>{item.title}</h3><small>{item.targetName} · {item.scheduledAt ? `Reja: ${formatDate(item.scheduledAt)}` : formatDate(item.createdAt)}</small></div>
                  <strong className={`announcement-status ${item.deliveryStatus.toLowerCase()}`}>{statusLabel(item.deliveryStatus)}</strong>
                </header>
                <p>{item.body}</p>
              </article>
            ))}
            {!query.isPending && filtered.length === 0 && <div className="dashboard-state">E’lon topilmadi</div>}
          </div>
        </section>

        <section className="panel announcements-help">
          <header><h2>Qoidalar</h2></header>
          <div>
            <p>Targeting: barcha ota-onalar, aniq guruh yoki kurs.</p>
            <p>Backend bosqichida xabarlar HTTP ichida yuborilmaydi, BullMQ navbati orqali ishlaydi.</p>
            <p>Status `BOT_DELIVERED` Telegram bot tomonidan yetkazilgan xabarni bildiradi.</p>
          </div>
        </section>
      </div>
    </section>
  )
}
