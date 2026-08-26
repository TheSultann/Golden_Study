import { CalendarDays } from 'lucide-react'
import { type ChangeEvent, type InputHTMLAttributes, useState, useEffect } from 'react'

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'defaultValue'> & {
  value?: string
  defaultValue?: string
  onChange?: (isoDate: string) => void
  name?: string
  'aria-label'?: string
}

export function isoToDisplayDate(raw: string): string {
  if (!raw) return ''
  const cleaned = raw.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const [year, month, day] = cleaned.split('-')
    return `${day}.${month}.${year}`
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(cleaned)) {
    return cleaned
  }
  return raw
}

export function displayToIsoDate(raw: string): string {
  if (!raw) return ''
  const cleaned = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(cleaned)) {
    const [day, month, year] = cleaned.split('.')
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return cleaned
}

function formatMask(inputDigits: string): string {
  const digits = inputDigits.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

export function DateInput({
  value: controlledValue,
  defaultValue,
  onChange,
  name = 'date',
  id,
  className,
  required,
  disabled,
  placeholder = 'ДД.ММ.ГГГГ',
  'aria-label': ariaLabel = 'Sana',
  ...props
}: DateInputProps) {
  const isControlled = controlledValue !== undefined

  const [textValue, setTextValue] = useState(() => {
    const init = controlledValue ?? defaultValue ?? new Date().toLocaleDateString('en-CA')
    return isoToDisplayDate(init)
  })

  useEffect(() => {
    if (isControlled && controlledValue !== undefined) {
      setTextValue(isoToDisplayDate(controlledValue))
    }
  }, [controlledValue, isControlled])

  const currentIso = displayToIsoDate(textValue)

  function handleTextInputChange(e: ChangeEvent<HTMLInputElement>) {
    const rawVal = e.target.value
    const digits = rawVal.replace(/\D/g, '').slice(0, 8)
    const formatted = formatMask(digits)
    
    if (!isControlled) {
      setTextValue(formatted)
    }

    if (digits.length === 8) {
      const day = digits.slice(0, 2)
      const month = digits.slice(2, 4)
      const year = digits.slice(4, 8)
      const newIso = `${year}-${month}-${day}`
      onChange?.(newIso)
    } else {
      onChange?.('')
    }
  }

  function openPicker() {
    if (disabled) return
    const tempPicker = document.createElement('input')
    tempPicker.type = 'date'
    tempPicker.value = currentIso
    tempPicker.onchange = (e) => {
      const val = (e.target as HTMLInputElement).value
      if (val) {
        const display = isoToDisplayDate(val)
        if (!isControlled) {
          setTextValue(display)
        }
        onChange?.(val)
      }
    }
    try {
      if ('showPicker' in tempPicker && typeof tempPicker.showPicker === 'function') {
        tempPicker.showPicker()
      } else {
        tempPicker.click()
      }
    } catch {
      tempPicker.click()
    }
  }

  return (
    <div className={`date-input-wrapper ${className ?? ''}`} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}>
      <input
        {...props}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        required={required}
        disabled={disabled}
        value={textValue}
        onChange={handleTextInputChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="date-text-input"
        style={{ width: '100%', paddingRight: '36px' }}
      />

      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Kalendarni ochish"
        onClick={openPicker}
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
        <CalendarDays size={16} />
      </button>
    </div>
  )
}
