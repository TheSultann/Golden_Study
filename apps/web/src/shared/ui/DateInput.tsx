import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  type ChangeEvent,
  type InputHTMLAttributes,
  useState,
  useEffect,
  useRef,
} from 'react'

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

const UZ_MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
]

const UZ_WEEKDAYS = ['Du', 'Se', 'Chor', 'Pay', 'Jum', 'Sha', 'Yak']

interface CalendarCell {
  year: number
  month: number
  day: number
  iso: string
  isCurrentMonth: boolean
}

function generateCalendarDays(viewYear: number, viewMonth: number): CalendarCell[] {
  const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonthYear = viewMonth === 0 ? viewYear - 1 : viewYear
  const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1
  const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate()

  const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1

  const cells: CalendarCell[] = []

  // Trailing days from previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    const mm = String(prevMonth + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push({
      year: prevMonthYear,
      month: prevMonth,
      day: d,
      iso: `${prevMonthYear}-${mm}-${dd}`,
      isCurrentMonth: false,
    })
  }

  // Current month days
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push({
      year: viewYear,
      month: viewMonth,
      day: d,
      iso: `${viewYear}-${mm}-${dd}`,
      isCurrentMonth: true,
    })
  }

  // Leading days of next month (fill up to 35 or 42 cells)
  const targetTotal = cells.length <= 35 ? 35 : 42
  const toAdd = targetTotal - cells.length
  for (let d = 1; d <= toAdd; d++) {
    const mm = String(nextMonth + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push({
      year: nextMonthYear,
      month: nextMonth,
      day: d,
      iso: `${nextMonthYear}-${mm}-${dd}`,
      isCurrentMonth: false,
    })
  }

  return cells
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
  const containerRef = useRef<HTMLDivElement>(null)

  const [isOpen, setIsOpen] = useState(false)

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

  // Current view year & month for calendar popover
  const [viewYear, setViewYear] = useState(() => {
    const init = displayToIsoDate(controlledValue ?? defaultValue ?? '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(init)) {
      return Number(init.slice(0, 4))
    }
    return new Date().getFullYear()
  })

  const [viewMonth, setViewMonth] = useState(() => {
    const init = displayToIsoDate(controlledValue ?? defaultValue ?? '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(init)) {
      return Number(init.slice(5, 7)) - 1
    }
    return new Date().getMonth()
  })

  // Close calendar popover on outside click or Escape
  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

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
      setViewYear(Number(year))
      setViewMonth(Number(month) - 1)
    } else {
      onChange?.('')
    }
  }

  function togglePicker() {
    if (disabled) return
    if (!isOpen) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(currentIso)) {
        setViewYear(Number(currentIso.slice(0, 4)))
        setViewMonth(Number(currentIso.slice(5, 7)) - 1)
      } else {
        const now = new Date()
        setViewYear(now.getFullYear())
        setViewMonth(now.getMonth())
      }
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }

  function goToPrevMonth() {
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => y - 1)
        return 11
      }
      return prev - 1
    })
  }

  function goToNextMonth() {
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => y + 1)
        return 0
      }
      return prev + 1
    })
  }

  function handleSelectDate(iso: string) {
    const display = isoToDisplayDate(iso)
    if (!isControlled) {
      setTextValue(display)
    }
    onChange?.(iso)
    setIsOpen(false)
  }

  function handleSelectToday() {
    const now = new Date()
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
    handleSelectDate(todayIso)
  }

  const now = new Date()
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const calendarCells = isOpen ? generateCalendarDays(viewYear, viewMonth) : []

  return (
    <div
      ref={containerRef}
      className={`date-input-wrapper ${className ?? ''}`}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}
    >
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
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={togglePicker}
        style={{
          position: 'absolute',
          right: '8px',
          background: 'none',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: isOpen ? 'var(--gold, #d4a017)' : 'var(--muted, #64748b)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          borderRadius: '4px',
          transition: 'color 120ms ease',
        }}
      >
        <CalendarDays size={16} />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Kalendar"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 90,
            width: '272px',
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
            padding: '12px',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            userSelect: 'none',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
              paddingBottom: '6px',
              borderBottom: '1px solid var(--border, #f1f5f9)',
            }}
          >
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label="Oldingi oy"
              style={{
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--surface-soft, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: '6px',
                color: 'var(--text, #16213a)',
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text, #16213a)',
              }}
            >
              {UZ_MONTHS[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="Keyingi oy"
              style={{
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--surface-soft, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: '6px',
                color: 'var(--text, #16213a)',
                cursor: 'pointer',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '2px',
              marginBottom: '4px',
            }}
          >
            {UZ_WEEKDAYS.map((wd) => (
              <div
                key={wd}
                style={{
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--muted, #64748b)',
                  padding: '3px 0',
                }}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '2px',
            }}
          >
            {calendarCells.map((cell) => {
              const isSelected = cell.iso === currentIso
              const isToday = cell.iso === todayIso

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => handleSelectDate(cell.iso)}
                  aria-selected={isSelected}
                  aria-label={`${cell.day} ${UZ_MONTHS[cell.month]} ${cell.year}`}
                  style={{
                    height: '30px',
                    width: '100%',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: isSelected ? 600 : isToday ? 600 : 400,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                    border: isToday && !isSelected
                      ? '1px solid var(--gold, #d4a017)'
                      : '1px solid transparent',
                    background: isSelected
                      ? 'var(--gold, #d4a017)'
                      : 'transparent',
                    color: isSelected
                      ? '#0b1220'
                      : isToday
                        ? 'var(--gold-dark, #b48508)'
                        : cell.isCurrentMonth
                          ? 'var(--text, #16213a)'
                          : 'var(--muted, #94a3b8)',
                    opacity: !cell.isCurrentMonth ? 0.45 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--surface-soft, #f1f5f9)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '8px',
              paddingTop: '6px',
              borderTop: '1px solid var(--border, #f1f5f9)',
            }}
          >
            <button
              type="button"
              onClick={handleSelectToday}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--gold-dark, #b48508)',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px',
              }}
            >
              Bugun
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                color: 'var(--muted, #64748b)',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px',
              }}
            >
              Yopish
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
