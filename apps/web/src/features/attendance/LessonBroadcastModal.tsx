import type { AttendanceBroadcastResult } from '@golden-study/contracts'
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Lock,
  Send,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface LessonBroadcastModalProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
  groupName: string
  date: string
  initialTopic: string
  initialHomework: string
  telegramChatTitle?: string | null
  telegramChatId?: string | null
  onBroadcast: (params: {
    sendToGroupChat: boolean
    sendToStudents: boolean
    topic: string
    homeworkText: string
  }) => Promise<AttendanceBroadcastResult>
  isPending: boolean
}

export function LessonBroadcastModal({
  isOpen,
  onClose,
  groupId: _groupId,
  groupName,
  date,
  initialTopic,
  initialHomework,
  telegramChatTitle,
  telegramChatId,
  onBroadcast,
  isPending,
}: LessonBroadcastModalProps) {
  const [topic, setTopic] = useState(initialTopic)
  const [homeworkText, setHomeworkText] = useState(initialHomework)
  const [sendToGroup, setSendToGroup] = useState(Boolean(telegramChatId))
  const [sendToStudents, setSendToStudents] = useState(true)
  const [previewTab, setPreviewTab] = useState<'group' | 'student'>('group')
  const [result, setResult] = useState<AttendanceBroadcastResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPending, onClose])

  if (!isOpen) return null

  const isGroupLinked = Boolean(telegramChatId)
  const hasContent = Boolean(topic.trim() || homeworkText.trim())
  const hasTarget = (sendToGroup && isGroupLinked) || sendToStudents

  async function handleSend() {
    if (!hasContent) {
      setErrorMsg('Mavzu yoki uyga vazifa kiritilishi shart!')
      return
    }
    if (!hasTarget) {
      setErrorMsg('Kamida bitta yuborish yo‘nalishini tanlang!')
      return
    }

    setErrorMsg(null)
    try {
      const res = await onBroadcast({
        sendToGroupChat: sendToGroup && isGroupLinked,
        sendToStudents,
        topic: topic.trim(),
        homeworkText: homeworkText.trim(),
      })
      setResult(res)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Xatolik yuz berdi'
      setErrorMsg(message)
    }
  }

  // Format date to DD.MM.YYYY
  const dateParts = date.split('-')
  const formattedDate =
    dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : date

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{ padding: '16px', overflowY: 'auto' }}
    >
      <div
        className="teacher-modal attendance-broadcast-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="broadcast-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 540,
          margin: 'auto',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header style={{ padding: '14px 20px' }}>
          <div>
            <h2 id="broadcast-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={18} style={{ color: '#0088cc' }} />
              Dars xulosasini yuborish
            </h2>
            <p>
              {groupName} • {formattedDate}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Yopish" disabled={isPending}>
            <X size={18} />
          </button>
        </header>

        <div
          style={{
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          {result ? (
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: 8,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 600, fontSize: 14 }}>
                <CheckCircle2 size={18} />
                <span>Dars xulosasi muvaffaqiyatli yuborildi!</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text)' }}>
                {result.message}
              </p>
              {result.nextLessonSummary && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  <strong>Keyingi dars:</strong> {result.nextLessonSummary}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Target selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.03em' }}>
                  YUBORISH YO‘NALISHLARI
                </span>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: sendToGroup && isGroupLinked ? 'rgba(0, 136, 204, 0.06)' : 'transparent',
                    cursor: isGroupLinked ? 'pointer' : 'not-allowed',
                    opacity: isGroupLinked ? 1 : 0.6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sendToGroup && isGroupLinked}
                    disabled={!isGroupLinked || isPending}
                    onChange={(e) => setSendToGroup(e.target.checked)}
                    style={{ width: 15, height: 15 }}
                  />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>Telegram guruhga</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {isGroupLinked
                          ? (telegramChatTitle ? `Chat: ${telegramChatTitle}` : 'Bog‘langan chatga')
                          : 'Ulanmagan (Guruhlar bo‘limida ulash mumkin)'}
                      </div>
                    </div>
                    {isGroupLinked ? (
                      <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '1px 7px', borderRadius: 10 }}>
                        Ulangan
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, background: '#fee2e2', color: '#b91c1c', padding: '1px 7px', borderRadius: 10 }}>
                        Ulanmagan
                      </span>
                    )}
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: sendToStudents ? 'rgba(212, 160, 23, 0.06)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sendToStudents}
                    disabled={isPending}
                    onChange={(e) => setSendToStudents(e.target.checked)}
                    style={{ width: 15, height: 15 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>O‘quvchilar botiga</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Har bir o‘quvchiga o‘zining darsdagi baholari va davomat holati bilan
                    </div>
                  </div>
                </label>
              </div>

              {/* Lesson plan fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, fontWeight: 500 }}>
                  Dars mavzusi:
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Masalan: 12-dars. Present Perfect Continuous"
                    disabled={isPending}
                    style={{
                      height: 32,
                      padding: '0 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      fontSize: 13,
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, fontWeight: 500 }}>
                  Uyga vazifa:
                  <textarea
                    value={homeworkText}
                    onChange={(e) => setHomeworkText(e.target.value)}
                    placeholder="Masalan: Workbook 45-bet, 1-4 mashqlarni to‘liq bajarish"
                    disabled={isPending}
                    rows={1}
                    style={{
                      minHeight: 34,
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      fontSize: 13,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </label>
              </div>

              {/* Preview Box */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: 'var(--surface, #fff)',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--surface-subtle, #f9fafb)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewTab('group')}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: 500,
                      background: previewTab === 'group' ? 'var(--surface, #fff)' : 'transparent',
                      border: 'none',
                      borderBottom: previewTab === 'group' ? '2px solid var(--accent, #d4a017)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Users size={13} />
                    <span>Guruh xabari (Ommaviy)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('student')}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: 500,
                      background: previewTab === 'student' ? 'var(--surface, #fff)' : 'transparent',
                      border: 'none',
                      borderBottom: previewTab === 'student' ? '2px solid var(--accent, #d4a017)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Info size={13} />
                    <span>O‘quvchi xabari (Shaxsiy)</span>
                  </button>
                </div>

                <div style={{ padding: '8px 12px', fontSize: 12, lineHeight: 1.4 }}>
                  {previewTab === 'group' ? (
                    <div style={{ color: 'var(--text)' }}>
                      <div>📚 <strong>Dars xulosasi: {groupName}</strong></div>
                      <div>📅 <strong>Sana:</strong> {formattedDate}</div>
                      {topic.trim() && <div>📘 <strong>Bugungi mavzu:</strong> {topic.trim()}</div>}
                      {homeworkText.trim() && <div>📝 <strong>Keyingi darsga vazifa:</strong> {homeworkText.trim()}</div>}
                      <div>⏰ <strong>Keyingi dars:</strong> Jadval bo‘yicha hisoblanadi</div>
                      <div
                        style={{
                          marginTop: 6,
                          padding: '4px 8px',
                          background: 'rgba(34, 197, 94, 0.08)',
                          borderRadius: 6,
                          fontSize: 11,
                          color: '#15803d',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Lock size={12} />
                        <span>Maxfiylik: O‘quvchilar ismlari, davomati yoki baholari guruhga chiqarilmaydi!</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text)' }}>
                      <div>📚 <strong>Dars xulosasi: {groupName}</strong></div>
                      <div>📅 <strong>Sana:</strong> {formattedDate}</div>
                      {topic.trim() && <div>📘 <strong>Bugungi mavzu:</strong> {topic.trim()}</div>}
                      {homeworkText.trim() && <div>📝 <strong>Keyingi darsga vazifa:</strong> {homeworkText.trim()}</div>}
                      <div>⏰ <strong>Keyingi dars:</strong> Jadval bo‘yicha hisoblanadi</div>
                      <div style={{ borderTop: '1px dashed var(--border)', margin: '4px 0' }} />
                      <div>👤 <strong>O‘quvchi:</strong> [O‘quvchi F.I.Sh]</div>
                      <div style={{ color: '#0369a1' }}>
                        📊 <strong>Davomat:</strong> [Davomat holati] | <strong>Baholar:</strong> [Har bir o‘quvchining o‘z shaxsiy baholari]
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Error warning */}
              {errorMsg && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: '#dc2626',
                    fontSize: 12,
                    background: '#fef2f2',
                    padding: '8px 12px',
                    borderRadius: 6,
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            flexShrink: 0,
            background: 'var(--surface)',
          }}
        >
          {result ? (
            <button
              type="button"
              className="primary-button"
              onClick={onClose}
              style={{ height: 36, fontSize: 13 }}
            >
              Yopish
            </button>
          ) : (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={isPending}
                style={{ height: 36, fontSize: 13 }}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleSend}
                disabled={isPending || !hasContent || !hasTarget}
                style={{
                  height: 36,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: hasContent && hasTarget ? '#0088cc' : undefined,
                }}
              >
                {isPending ? (
                  <span>Yuborilmoqda...</span>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Yuborish</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
