import { Eye, EyeOff } from 'lucide-react'
import { type InputHTMLAttributes, useState } from 'react'

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement> & {
  'aria-label'?: string
}

export function PasswordInput({
  className,
  disabled,
  'aria-label': ariaLabel,
  style,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div
      className={`password-input-wrapper ${className ?? ''}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: '100%',
      }}
    >
      <input
        {...props}
        type={showPassword ? 'text' : 'password'}
        disabled={disabled}
        aria-label={ariaLabel}
        className="password-text-input"
        style={{
          width: '100%',
          paddingRight: '36px',
          ...style,
        }}
      />

      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
        title={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
        onClick={() => setShowPassword((prev) => !prev)}
        style={{
          position: 'absolute',
          right: '10px',
          background: 'none',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: 'var(--muted, #64748b)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
        }}
      >
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
