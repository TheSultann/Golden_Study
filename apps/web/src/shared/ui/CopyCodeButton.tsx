import { Check, Copy } from 'lucide-react'
import { useState, type MouseEvent } from 'react'

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function onCopy(e: MouseEvent) {
    e.stopPropagation()
    void navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <span className="code-copy-inline">
      <span className="student-card-code code-copy-text">{code}</span>
      <button
        type="button"
        className={`code-copy-btn ${copied ? 'copied' : ''}`}
        title={`${code} nusxalash`}
        aria-label={`${code} nusxalash`}
        onClick={onCopy}
      >
        {copied ? <Check size={12} className="copy-check-icon" /> : <Copy size={12} />}
      </button>
    </span>
  )
}
