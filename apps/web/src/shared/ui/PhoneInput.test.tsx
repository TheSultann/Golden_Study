import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhoneInput, formatDisplayPhone, normalizePhoneWithPrefix } from './PhoneInput'

describe('PhoneInput component & helpers', () => {
  it('correctly normalizes full phone with prefix, formatted phone, and raw 9 digits', () => {
    expect(normalizePhoneWithPrefix('+998901234567')).toBe('+998901234567')
    expect(normalizePhoneWithPrefix('+998 90 123 45 67')).toBe('+998901234567')
    expect(normalizePhoneWithPrefix('998901234567')).toBe('+998901234567')
    expect(normalizePhoneWithPrefix('901234567')).toBe('+998901234567')
    expect(normalizePhoneWithPrefix('90 123 45 67')).toBe('+998901234567')
    expect(normalizePhoneWithPrefix('')).toBe('')
  })

  it('formats display phone nicely', () => {
    expect(formatDisplayPhone('+998901234567')).toBe('+998 90 123 45 67')
    expect(formatDisplayPhone('901234567')).toBe('+998 90 123 45 67')
  })

  it('handles pasting full +998 number without duplicating 998 prefix', () => {
    render(<PhoneInput name="phone" defaultValue="" />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '+998901234567' } })
    expect(input).toHaveValue('90 123 45 67')
  })

  it('updates when defaultValue prop changes', () => {
    const { rerender } = render(<PhoneInput name="phone" defaultValue="+998901112233" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('90 111 22 33')

    rerender(<PhoneInput name="phone" defaultValue="+998909998877" />)
    expect(input).toHaveValue('90 999 88 77')
  })
})
