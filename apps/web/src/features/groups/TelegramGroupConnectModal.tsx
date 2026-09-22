import type { Group } from '@golden-study/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, ExternalLink, Send, Unlink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useUnlinkGroupTelegram } from './useGroups'

interface TelegramGroupConnectModalProps {
  group: Group
  onClose: () => void
}

export function TelegramGroupConnectModal({ group, onClose }: TelegramGroupConnectModalProps) {
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()
  const unlinkMutation = useUnlinkGroupTelegram()

  const isConnected = Boolean(group.telegramChatId)

  useEffect(() => {
    if (isConnected) return
    const interval = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
    }, 1500)
    return () => clearInterval(interval)
  }, [isConnected, queryClient])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !unlinkMutation.isPending) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [unlinkMutation.isPending, onClose])

  const botUsername =
    (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.trim() || 'Golden_StudyBot'
  const connectCommand = `/connect@${botUsername} ${group.id}`
  const deepLink = `https://t.me/${botUsername}?startgroup=group_${group.id}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(connectCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback if clipboard API fails
      setCopied(false)
    }
  }

  async function handleUnlink() {
    if (!group.id) return
    try {
      await unlinkMutation.mutateAsync(group.id)
      onClose()
    } catch {
      // Handled by mutation error state
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="teacher-modal telegram-connect-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tg-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 480,
          maxHeight: 'min(90vh, 680px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header>
          <div>
            <h2 id="tg-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={18} style={{ color: '#0088cc' }} />
              Telegram guruhni ulash
            </h2>
            <p>{group.name} guruhi uchun bildirishnomalar sozlamasi</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Yopish">
            <X size={18} />
          </button>
        </header>

        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          {isConnected ? (
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 600, fontSize: 13 }}>
                <Check size={16} />
                <span>Guruh muvaffaqiyatli bog‘langan</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>
                <strong>Chat:</strong> {group.telegramChatTitle || 'Telegram guruhi'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                ID: {group.telegramChatId}
              </div>

              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleUnlink}
                  disabled={unlinkMutation.isPending}
                  style={{
                    color: '#dc2626',
                    borderColor: 'rgba(220, 38, 38, 0.3)',
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                  }}
                >
                  <Unlink size={14} />
                  <span>{unlinkMutation.isPending ? 'Uzilmoqda...' : 'Guruhni uzish'}</span>
                </button>
                {unlinkMutation.isError && (
                  <p style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>
                    Guruhni uzishda xatolik yuz berdi.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
                Guruh o‘quvchilari va ota-onalariga dars mavzusi hamda uyga vazifalarni yuborish uchun Telegram guruhni ulang:
              </div>

              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--text)',
                }}
              >
                ⚠️ <strong>Muhim:</strong> Telegram guruh maxfiylik sozlamalari tufayli, bot xabarlarni ko‘rishi va yuborishi uchun uni guruhga <strong>Administrator (admin)</strong> sifatida qo‘shishingiz shart.
              </div>

              <div
                style={{
                  background: 'var(--surface-subtle, rgba(0,0,0,0.03))',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>1-usul: Havola orqali botni qo‘shish</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Botni (@{botUsername}) guruhingizga tanlang va Administrator qilib qo‘shing:
                </div>
                <a
                  href={deepLink}
                  target="_blank"
                  rel="noreferrer"
                  className="primary-button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    textDecoration: 'none',
                    height: 36,
                    fontSize: 13,
                    background: '#0088cc',
                    color: '#fff',
                  }}
                >
                  <ExternalLink size={14} />
                  <span>Telegram guruhga qo‘shish (@{botUsername})</span>
                </a>
              </div>

              <div
                style={{
                  background: 'var(--surface-subtle, rgba(0,0,0,0.03))',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>2-usul: Buyruq orqali ulash</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Botni guruhingizga Admin qilib qo‘shgach, guruh chatiga ushbu buyruqni yuboring:
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--surface, #fff)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontFamily: 'monospace',
                    fontSize: 12,
                  }}
                >
                  <code style={{ color: 'var(--accent, #d4a017)', fontWeight: 600 }}>{connectCommand}</code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      color: copied ? '#15803d' : 'var(--muted)',
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Nusxalandi!' : 'Nusxa olish'}</span>
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(212, 160, 23, 0.08)',
                  border: '1px solid rgba(212, 160, 23, 0.2)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 11,
                  color: 'var(--muted)',
                  lineHeight: 1.4,
                }}
              >
                🔒 <strong>Maxfiylik kafolati:</strong> Telegram guruh chatiga o‘quvchilarning baholari, davomati yoki qarzlari aslo chiqarilmaydi. Faqat umumiy dars mavzusi va uyga vazifalar yuboriladi.
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            flexShrink: 0,
            background: 'var(--surface)',
          }}
        >
          <button type="button" className="secondary-button" onClick={onClose} style={{ height: 34, fontSize: 13 }}>
            Yopish
          </button>
        </div>
      </div>
    </div>
  )
}
