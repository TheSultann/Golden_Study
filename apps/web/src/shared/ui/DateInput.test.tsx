import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DateInput, displayToIsoDate, isoToDisplayDate } from './DateInput'

describe('DateInput component', () => {
  it('converts between ISO and display formats correctly', () => {
    expect(isoToDisplayDate('2026-07-25')).toBe('25.07.2026')
    expect(displayToIsoDate('25.07.2026')).toBe('2026-07-25')
  })

  it('renders displayed date strictly in DD.MM.YYYY format', () => {
    render(<DateInput defaultValue="2026-07-25" name="testDate" aria-label="Sana" />)
    const input = screen.getByLabelText('Sana') as HTMLInputElement
    expect(input.value).toBe('25.07.2026')
  })

  it('updates input value and triggers onChange with ISO value when 8 digits typed', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<DateInput onChange={handleChange} name="myDate" aria-label="Sana" />)

    const input = screen.getByLabelText('Sana') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '15082026')

    expect(input.value).toBe('15.08.2026')
    expect(handleChange).toHaveBeenCalledWith('2026-08-15')
  })

  it('opens modern calendar dropdown and selects date on day click', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<DateInput value="2026-09-21" onChange={handleChange} aria-label="Sana" />)

    const calendarBtn = screen.getByLabelText('Kalendarni ochish')
    await user.click(calendarBtn)

    expect(screen.getByRole('dialog', { name: 'Kalendar' })).toBeInTheDocument()
    expect(screen.getByText('Sentabr 2026')).toBeInTheDocument()

    // Click day 22
    const day22 = screen.getByRole('button', { name: '22 Sentabr 2026' })
    await user.click(day22)

    expect(handleChange).toHaveBeenCalledWith('2026-09-22')
    // Popover closes after selection
    expect(screen.queryByRole('dialog', { name: 'Kalendar' })).not.toBeInTheDocument()
  })

  it('selects today when "Bugun" button is clicked', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<DateInput value="2026-09-21" onChange={handleChange} aria-label="Sana" />)

    const calendarBtn = screen.getByLabelText('Kalendarni ochish')
    await user.click(calendarBtn)

    const todayBtn = screen.getByRole('button', { name: 'Bugun' })
    await user.click(todayBtn)

    const now = new Date()
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(handleChange).toHaveBeenCalledWith(todayIso)
  })
})
