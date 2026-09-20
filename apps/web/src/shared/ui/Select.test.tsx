import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Select } from './Select'

const sampleOptions = [
  { value: 'm1', label: 'Matematika M1' },
  { value: 'a1', label: 'English A1' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'grammer', label: 'Grammer Guruh English' },
]

describe('Select Component', () => {
  it('renders trigger with current selected label and keeps native combobox synced', () => {
    render(
      <Select
        aria-label="Guruh"
        value="grammer"
        onChange={vi.fn()}
        options={sampleOptions}
      />,
    )

    const nativeCombobox = screen.getByRole('combobox', { name: 'Guruh' })
    expect(nativeCombobox).toBeInTheDocument()
    expect(nativeCombobox).toHaveValue('grammer')

    const trigger = screen.getByTestId('modern-select-trigger')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveTextContent('Grammer Guruh English')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens options dropdown upon clicking trigger and selects an option', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Select
        aria-label="Guruh"
        value="grammer"
        onChange={handleChange}
        options={sampleOptions}
      />,
    )

    const trigger = screen.getByTestId('modern-select-trigger')
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    // Click 'English A1' in the modern dropdown listbox
    const listbox = screen.getByRole('listbox')
    const optionA1 = within(listbox).getByText('English A1')
    await user.click(optionA1)

    expect(handleChange).toHaveBeenCalledWith('a1')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('navigates options via keyboard arrows and selects with Enter', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Select
        aria-label="Guruh"
        value="m1"
        onChange={handleChange}
        options={sampleOptions}
      />,
    )

    const trigger = screen.getByTestId('modern-select-trigger')
    trigger.focus()

    // Press ArrowDown to open
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    // Move to next option and press Enter
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(handleChange).toHaveBeenCalledWith('a1')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes dropdown when Escape key is pressed', async () => {
    const user = userEvent.setup()

    render(
      <Select
        aria-label="Guruh"
        value="m1"
        onChange={vi.fn()}
        options={sampleOptions}
      />,
    )

    const trigger = screen.getByTestId('modern-select-trigger')
    await user.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes dropdown on click outside', async () => {
    const user = userEvent.setup()

    render(
      <div>
        <div data-testid="outside">Outside area</div>
        <Select
          aria-label="Guruh"
          value="m1"
          onChange={vi.fn()}
          options={sampleOptions}
        />
      </div>,
    )

    const trigger = screen.getByTestId('modern-select-trigger')
    await user.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
