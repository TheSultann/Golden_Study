import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
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

  it('allows typing into controlled DateInput component and updates display', async () => {
    const user = userEvent.setup()
    let controlled = ''
    const handleChange = vi.fn((iso: string) => {
      controlled = iso
    })

    const { rerender } = render(
      <DateInput value={controlled} onChange={handleChange} aria-label="Sana" />
    )

    const input = screen.getByLabelText('Sana') as HTMLInputElement
    await user.type(input, '25112026')

    expect(handleChange).toHaveBeenCalledWith('2026-11-25')
    rerender(<DateInput value={controlled} onChange={handleChange} aria-label="Sana" />)
    expect(input.value).toBe('25.11.2026')
  })

  it('keeps in-progress typing intact in a real useState controlled wrapper without wiping', async () => {
    const user = userEvent.setup()
    function ControlledHost() {
      const [dateVal, setDateVal] = useState('')
      return (
        <div>
          <DateInput value={dateVal} onChange={setDateVal} aria-label="Sana" />
          <span data-testid="selected-iso">{dateVal}</span>
        </div>
      )
    }

    render(<ControlledHost />)
    const input = screen.getByLabelText('Sana') as HTMLInputElement
    const isoDisplay = screen.getByTestId('selected-iso')

    // Type 2 digits
    await user.type(input, '12')
    expect(input.value).toBe('12')
    expect(isoDisplay.textContent).toBe('')

    // Type remaining digits to complete 12.05.2026
    await user.type(input, '052026')
    expect(input.value).toBe('12.05.2026')
    expect(isoDisplay.textContent).toBe('2026-05-12')
  })
})
