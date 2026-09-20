import { Check, ChevronDown, Search } from 'lucide-react'
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
  id?: string
  name?: string
  searchable?: boolean
  width?: string | number
  minWidth?: string | number
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Tanlang...',
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
  id,
  name,
  searchable = false,
  width,
  minWidth,
}: SelectProps) {
  const generatedId = useId()
  const selectId = id || generatedId
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const selectedOption = options.find((opt) => opt.value === value)

  const showSearch = searchable || options.length > 7

  const filteredOptions = showSearch && searchQuery.trim()
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : options

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen])

  // Focus search or first option on open
  useEffect(() => {
    if (isOpen) {
      const activeIdx = options.findIndex((opt) => opt.value === value)
      setFocusedIndex(activeIdx >= 0 ? activeIdx : 0)
      if (showSearch) {
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
    } else {
      setSearchQuery('')
      setFocusedIndex(-1)
    }
  }, [isOpen, value, showSearch, options])

  function handleTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(true)
    }
  }

  function handleListKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      containerRef.current?.querySelector<HTMLButtonElement>('.modern-select-trigger')?.focus()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
    } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
      e.preventDefault()
      const target = filteredOptions[focusedIndex]
      if (target && !target.disabled) {
        onChange(target.value)
        setIsOpen(false)
        containerRef.current?.querySelector<HTMLButtonElement>('.modern-select-trigger')?.focus()
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={`modern-select-container ${className} ${disabled ? 'is-disabled' : ''} ${isOpen ? 'is-open' : ''}`}
      onKeyDown={handleListKeyDown}
      style={{
        position: 'relative',
        width: width ?? '100%',
        minWidth: minWidth ?? undefined,
      }}
    >
      {/* Accessible native select for form compatibility and test runners */}
      <select
        id={selectId}
        name={name}
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="modern-select-native"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Styled Modern Trigger Button */}
      <button
        type="button"
        data-testid="modern-select-trigger"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${selectId}-listbox`}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        className="modern-select-trigger"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: 40,
          padding: '0 12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: selectedOption ? 'var(--text)' : 'var(--muted)',
          fontSize: 13,
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxSizing: 'border-box',
          textAlign: 'left',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          borderColor: isOpen ? 'var(--gold)' : undefined,
          boxShadow: isOpen ? '0 0 0 3px rgb(var(--accent-rgb) / 14%)' : undefined,
        }}
      >
        <div
          className="modern-select-label"
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingRight: 8,
            border: 0,
            background: 'transparent',
            borderRadius: 0,
            padding: 0,
            boxShadow: 'none',
            fontSize: 13,
            lineHeight: '40px',
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </div>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--muted)',
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s ease',
          }}
        />
      </button>

      {/* Modern Popover Menu */}
      {isOpen && (
        <div
          className="modern-select-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 'max(100%, 230px)',
            maxWidth: 'min(380px, calc(100vw - 24px))',
            width: 'max-content',
            maxHeight: 280,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            boxShadow:
              '0 12px 28px -4px rgba(15, 23, 42, 0.14), 0 4px 10px -2px rgba(15, 23, 42, 0.06)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'modernSelectFadeIn 0.12s ease-out',
          }}
        >
          {showSearch && (
            <div
              style={{
                padding: '7px 9px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Search size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setFocusedIndex(0)
                }}
                placeholder="Qidirish..."
                style={{
                  width: '100%',
                  border: 0,
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: 12,
                  padding: '2px 0',
                }}
              />
            </div>
          )}

          <ul
            ref={listRef}
            id={`${selectId}-listbox`}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 4,
              overflowY: 'auto',
              maxHeight: 220,
            }}
          >
            {filteredOptions.length === 0 ? (
              <li
                style={{
                  padding: '10px 12px',
                  color: 'var(--muted)',
                  fontSize: 12,
                  textAlign: 'center',
                }}
              >
                Topilmadi
              </li>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value
                const isFocused = idx === focusedIndex

                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    onClick={() => {
                      if (!opt.disabled) {
                        onChange(opt.value)
                        setIsOpen(false)
                        containerRef.current?.querySelector<HTMLButtonElement>('.modern-select-trigger')?.focus()
                      }
                    }}
                    onMouseEnter={() => !opt.disabled && setFocusedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      minHeight: 36,
                      padding: '0 12px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: isSelected ? 500 : 400,
                      color: isSelected ? 'var(--gold-dark, #b48508)' : 'var(--text)',
                      background: isSelected
                        ? 'rgba(212, 160, 23, 0.08)'
                        : isFocused
                          ? 'var(--surface-soft)'
                          : 'transparent',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      opacity: opt.disabled ? 0.5 : 1,
                      userSelect: 'none',
                      transition: 'background 0.12s ease',
                      border: 0,
                      boxShadow: 'none',
                      marginBottom: 2,
                      gap: 10,
                    }}
                  >
                    <div
                      className="modern-select-option-text"
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        border: 0,
                        background: 'transparent',
                        borderRadius: 0,
                        padding: 0,
                        boxShadow: 'none',
                        fontSize: 13,
                      }}
                    >
                      {opt.label}
                    </div>
                    {isSelected && (
                      <Check
                        size={15}
                        style={{
                          color: 'var(--gold)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
