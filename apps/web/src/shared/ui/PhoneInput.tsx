import { type ChangeEvent, type InputHTMLAttributes, useEffect, useState } from 'react'

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  value?: string
  defaultValue?: string
  onChange?: (fullPhoneWithPrefix: string) => void
  name?: string
  'aria-label'?: string
}

function extractNationalDigits(val: unknown): string {
  const str = String(val ?? '').trim()
  const digits = str.replace(/\D/g, '')
  const withoutPrefix = digits.startsWith('998') ? digits.slice(3) : digits
  return withoutPrefix.slice(0, 9)
}

function formatNationalNumber(digits: string): string {
  if (!digits) return ''
  const d = digits.slice(0, 9)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`
  if (d.length <= 7) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`
}

export function PhoneInput({
  value: controlledValue,
  defaultValue,
  onChange,
  disabled,
  required,
  placeholder = '90 123 45 67',
  name = 'phone',
  id,
  className,
  'aria-label': ariaLabel,
  ...props
}: PhoneInputProps) {
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState(() => defaultValue ?? '')

  useEffect(() => {
    if (!isControlled && defaultValue !== undefined) {
      setInternalValue(defaultValue)
    }
  }, [defaultValue, isControlled])

  const currentVal = isControlled ? controlledValue : internalValue
  const nationalDigits = extractNationalDigits(currentVal)
  const displayValue = formatNationalNumber(nationalDigits)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const natDigits = extractNationalDigits(raw)
    const fullValue = natDigits ? `+998${natDigits}` : ''
    if (!isControlled) {
      setInternalValue(fullValue)
    }
    onChange?.(fullValue)
  }

  const defaultAriaLabel = name === 'parentPhone' ? 'Ota-ona telefoni' : 'Telefon'

  return (
    <div className={`phone-input-wrapper ${className ?? ''}`}>
      <span className="phone-prefix-badge">+998</span>
      <input
        {...props}
        id={id}
        name={name}
        type="tel"
        required={required}
        disabled={disabled}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={12}
        aria-label={ariaLabel ?? defaultAriaLabel}
        className="phone-national-input"
      />
    </div>
  )
}

export function normalizePhoneWithPrefix(val: unknown): string {
  const str = String(val ?? '').trim()
  if (!str) return ''
  const natDigits = extractNationalDigits(str)
  return natDigits ? `+998${natDigits}` : ''
}

export function formatDisplayPhone(phone: unknown): string {
  const str = String(phone ?? '').trim()
  if (!str) return ''
  const digits = str.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('998')) {
    const nat = digits.slice(3)
    return `+998 ${nat.slice(0, 2)} ${nat.slice(2, 5)} ${nat.slice(5, 7)} ${nat.slice(7)}`.trim()
  }
  if (digits.length === 9) {
    return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`.trim()
  }
  return str
}

