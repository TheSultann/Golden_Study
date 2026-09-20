import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

type ConfirmDialogProps = {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  pending?: boolean
  errorMessage?: string | null
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, description, confirmLabel, cancelLabel, pending = false, errorMessage, variant = 'danger', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="modal-backdrop">
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {variant === 'primary' ? (
            <CheckCircle2 size={20} style={{ color: '#10b981', flexShrink: 0 }} />
          ) : null}
          <h2 id="confirm-dialog-title" style={{ margin: 0 }}>{title}</h2>
        </div>
        <p id="confirm-dialog-description">{description}</p>
        {errorMessage ? (
          <div className="confirm-dialog-error" role="alert">
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMessage.replace(/^[\u{26D4}\u{26A0}]\u{FE0F}?\s*/u, '')}</span>
          </div>
        ) : null}
        <footer>
          <button
            type="button"
            className="secondary-button"
            disabled={pending}
            onClick={() => {
              if (pending) return
              onCancel()
            }}
          >
            {cancelLabel ?? 'Bekor qilish'}
          </button>
          <button
            type="button"
            className={variant === 'danger' ? 'danger-button' : 'primary-button'}
            disabled={pending}
            onClick={() => {
              if (pending) return
              onConfirm()
            }}
            style={pending ? { opacity: 0.7, cursor: 'not-allowed', pointerEvents: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' } : { display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {pending ? (
              <>
                <Loader2 className="animate-spin" size={15} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Saqlanmoqda...</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </footer>
      </section>
    </div>
  )
}

