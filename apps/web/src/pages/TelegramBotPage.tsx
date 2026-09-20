import type { TelegramBotOverview, TelegramLink, TelegramNotificationLog, TelegramTriggerType } from '@golden-study/contracts'
import { CheckCircle2, Clock3, Link2, Send, X, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useEnqueueTelegramNotification, useSetTelegramLinkStatus, useTelegramBotOverview } from '../features/telegram/useTelegramBot'

const triggerLabels: Record<TelegramTriggerType, string> = {
  attendance_absent: 'Sababsiz kelmadi',
  homework_missing: 'Uy vazifasi bajarilmadi',
  exam_result: 'Imtihon natijasi',
  payment_received: "To'lov qabul qilindi",
  debt_reminder: 'Qarz eslatmasi',
  announcement: "E'lon",
  lesson_broadcast: 'Dars xulosasi',
}

const statusLabels: Record<TelegramLink['status'], string> = { pending: 'Kutilmoqda', active: 'Faol', rejected: 'Rad etilgan' }
const notificationStatusLabels: Record<TelegramNotificationLog['status'], string> = { queued: 'Navbatda', sent: 'Yuborildi', failed: 'Xato' }

function formatDate(value: string | null) {
  if (!value) return '-'
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Tashkent',
  }).formatToParts(new Date(value))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('day')}.${get('month')}.${get('year')}`
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tashkent' }).format(date)
  return `${formatDate(value)} ${time}`
}

export function TelegramBotPage() {
  const query = useTelegramBotOverview()
  const setStatus = useSetTelegramLinkStatus()
  const enqueue = useEnqueueTelegramNotification()
  const [statusFilter, setStatusFilter] = useState<'all' | TelegramLink['status']>('pending')
  const [selectedTrigger, setSelectedTrigger] = useState<TelegramTriggerType>('debt_reminder')
  const overview = query.data
  const links = useMemo(() => overview?.links.filter((link) => statusFilter === 'all' || link.status === statusFilter) ?? [], [overview, statusFilter])

  async function approve(link: TelegramLink) {
    await setStatus.mutateAsync({ id: link.id, status: 'active' })
  }

  async function reject(link: TelegramLink) {
    await setStatus.mutateAsync({ id: link.id, status: 'rejected' })
  }

  async function sendManual(link: TelegramLink) {
    await enqueue.mutateAsync({ linkId: link.id, triggerType: selectedTrigger })
  }

  return (
    <section className="telegram-page">
      <div className="page-heading">
        <div>
          <h1>Telegram Bot</h1>
          <p>Telegram bot ulanishlari, BullMQ navbati va push bildirishnomalar jurnali</p>
        </div>
      </div>

      {query.isPending && <div className="dashboard-state">Telegram Bot yuklanmoqda...</div>}
      {query.isError && <div className="dashboard-state dashboard-error">Telegram Bot yuklanmadi</div>}
      {overview && <TelegramContent overview={overview} links={links} statusFilter={statusFilter} setStatusFilter={setStatusFilter} selectedTrigger={selectedTrigger} setSelectedTrigger={setSelectedTrigger} approve={approve} reject={reject} sendManual={sendManual} />}
    </section>
  )
}

function TelegramContent({ overview, links, statusFilter, setStatusFilter, selectedTrigger, setSelectedTrigger, approve, reject, sendManual }: {
  overview: TelegramBotOverview
  links: TelegramLink[]
  statusFilter: 'all' | TelegramLink['status']
  setStatusFilter: (status: 'all' | TelegramLink['status']) => void
  selectedTrigger: TelegramTriggerType
  setSelectedTrigger: (trigger: TelegramTriggerType) => void
  approve: (link: TelegramLink) => Promise<void>
  reject: (link: TelegramLink) => Promise<void>
  sendManual: (link: TelegramLink) => Promise<void>
}) {
  const linksById = new Map(overview.links.map((link) => [link.id, link]))
  const [selectedLog, setSelectedLog] = useState<TelegramNotificationLog | null>(null)
  const selectedRecipient = selectedLog ? linksById.get(selectedLog.telegramLinkId) : null

  return (
    <>
      <div className="telegram-summary">
        <article><span><CheckCircle2 size={16} /></span><div className="telegram-summary-content"><p>Bot holati</p><strong>{overview.service.status === 'online' ? 'Online' : 'Offline'}</strong><small>{overview.service.mode}</small></div></article>
        <article><span><Clock3 size={16} /></span><div className="telegram-summary-content"><p>Navbatda</p><strong>{overview.queue.waiting}</strong><small>active: {overview.queue.active}</small></div></article>
        <article><span><Send size={16} /></span><div className="telegram-summary-content"><p>Bugun yuborildi</p><strong>{overview.queue.sentToday}</strong><small>xato: {overview.queue.failed}</small></div></article>
        <article><span><Link2 size={16} /></span><div className="telegram-summary-content"><p>Faol ulanish</p><strong>{overview.links.filter((link) => link.status === 'active').length}</strong><small>{overview.links.length} jami</small></div></article>
      </div>

      <div className="telegram-layout">
        <section className="panel telegram-links">
          <header>
            <div><h2>Ulanish so'rovlari</h2><span className="finance-note">Telegram profil ulanishini tasdiqlash</span></div>
            <select aria-label="Telegram link holati" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | TelegramLink['status'])}>
              <option value="pending">Kutilmoqda</option>
              <option value="active">Faol</option>
              <option value="rejected">Rad etilgan</option>
              <option value="all">Barchasi</option>
            </select>
          </header>
          <div className="table-scroll">
            <table aria-label="Telegram ulanishlari">
              <thead><tr><th>O'quvchi</th><th>Bog'langan profil</th><th>Chat ID</th><th>Holat</th><th>So'rov</th><th>Amal</th></tr></thead>
              <tbody>{links.map((link) => <tr key={link.id}><td data-label="O‘quvchi"><strong>{link.studentName}</strong><span>{link.studentCode}</span></td><td data-label="Bog'langan profil"><strong>{link.parentName}</strong><span>{link.parentPhone}</span></td><td data-label="Chat ID">{link.telegramChatId}</td><td data-label="Holat"><span className={`telegram-status ${link.status}`}>{statusLabels[link.status]}</span></td><td data-label="So‘rov">{formatDate(link.requestedAt)}</td><td data-label="Amallar"><div className="telegram-actions">{link.status === 'pending' && <><button type="button" className="telegram-approve-button" onClick={() => void approve(link)}><CheckCircle2 size={13} /> Tasdiqlash</button><button type="button" className="telegram-reject-button" onClick={() => void reject(link)}><XCircle size={13} /> Rad etish</button></>}{link.status === 'active' && <button type="button" className="telegram-test-button" onClick={() => void sendManual(link)}><Send size={13} /> Test yuborish</button>}</div></td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <aside className="panel telegram-control">
          <header><h2>Test xabari</h2></header>
          <div>
            <label>Xabar turi<select aria-label="Telegram trigger" value={selectedTrigger} onChange={(event) => setSelectedTrigger(event.target.value as TelegramTriggerType)}>{Object.entries(triggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
        </aside>
      </div>

      <section className="panel telegram-log">
        <header><h2>Xabarlar jurnali</h2><span>{overview.notifications.length} yozuv</span></header>
        <div className="table-scroll">
          <table aria-label="Telegram notification log">
            <thead><tr><th>Qabul qiluvchi</th><th>Trigger</th><th>Holat</th><th>Xabar</th><th>Urinish</th><th>Vaqt</th><th>Tafsilot</th></tr></thead>
            <tbody>{overview.notifications.map((item) => {
              const recipient = linksById.get(item.telegramLinkId)
              return <tr key={item.id}>
                <td data-label="Qabul qiluvchi" className="telegram-recipient"><strong>{recipient?.parentName ?? 'Noma’lum'}</strong><span>{recipient ? `${recipient.studentName} · ${recipient.studentCode}` : item.telegramLinkId}</span></td>
                <td data-label="Trigger">{triggerLabels[item.triggerType]}</td>
                <td data-label="Holat"><span className={`telegram-status ${item.status}`}>{notificationStatusLabels[item.status]}</span></td>
                <td data-label="Xabar">{item.payload}</td>
                <td data-label="Urinish">{item.attempts}/{item.maxAttempts}</td>
                <td data-label="Yuborilgan vaqt">{formatDate(item.sentAt ?? item.queuedAt)}</td>
                <td data-label="Tafsilot"><button type="button" className="telegram-details-button" onClick={() => setSelectedLog(item)}>Ko‘rish</button></td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </section>

      {selectedLog && <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
        <section className="teacher-modal telegram-log-modal" role="dialog" aria-modal="true" aria-labelledby="telegram-log-dialog-title" onClick={(event) => event.stopPropagation()}>
          <header><div><h2 id="telegram-log-dialog-title">Xabar tafsilotlari</h2><p>{triggerLabels[selectedLog.triggerType]}</p></div><button type="button" aria-label="Tafsilotlarni yopish" onClick={() => setSelectedLog(null)}><X size={18} /></button></header>
          <dl>
            <div><dt>Bog'langan profil</dt><dd>{selectedRecipient?.parentName ?? 'Noma’lum'}</dd></div>
            <div><dt>O‘quvchi</dt><dd>{selectedRecipient ? `${selectedRecipient.studentName} · ${selectedRecipient.studentCode}` : selectedLog.telegramLinkId}</dd></div>
            <div><dt>Chat ID</dt><dd>{selectedRecipient?.telegramChatId ?? 'Topilmadi'}</dd></div>
            <div><dt>Job ID</dt><dd>{selectedLog.jobId}</dd></div>
            <div><dt>Navbatga qo‘yildi</dt><dd>{formatDateTime(selectedLog.queuedAt)}</dd></div>
            <div><dt>Yuborildi</dt><dd>{formatDateTime(selectedLog.sentAt)}</dd></div>
            <div><dt>Urinishlar</dt><dd>{selectedLog.attempts}/{selectedLog.maxAttempts}</dd></div>
            {selectedLog.errorMessage && <div className="telegram-log-error"><dt>Xato</dt><dd>{selectedLog.errorMessage}</dd></div>}
          </dl>
        </section>
      </div>}

    </>
  )
}
