import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { UnsavedChangesProvider, useUnsavedChanges } from './shared/context/UnsavedChangesContext'
import { Sidebar } from './widgets/app-shell/Sidebar'

describe('Sidebar brand', () => {
  it('uses the extracted Golden Study emblem', () => {
    render(
      <MemoryRouter>
        <Sidebar role="admin" open={false} onClose={vi.fn()} onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    const brand = screen.getByText('Golden Study CRM').closest('.sidebar-brand')
    expect(brand?.querySelector('img.sidebar-logo-image')).toHaveAttribute('src', expect.stringContaining('golden-study-emblem'))
    expect(brand?.querySelector('.sidebar-logo')).not.toBeInTheDocument()
  })

  it('blocks navigation and shows confirmation when changes are dirty', async () => {
    const user = userEvent.setup()
    function TestApp() {
      const { setDirty } = useUnsavedChanges()
      return (
        <div>
          <button onClick={() => setDirty(true)}>Make Dirty</button>
          <Sidebar role="admin" open={false} onClose={vi.fn()} onLogout={vi.fn()} />
        </div>
      )
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <UnsavedChangesProvider>
          <TestApp />
        </UnsavedChangesProvider>
      </MemoryRouter>,
    )

    // Mark dirty
    await user.click(screen.getByText('Make Dirty'))

    // Click on O'quvchilar link
    const studentsLink = screen.getByRole('link', { name: /O‘quvchilar/i })
    await user.click(studentsLink)

    // Confirm dialog must appear
    expect(screen.getByText('O‘zgarishlar saqlanmagan')).toBeInTheDocument()
    expect(screen.getByText('Boshqa bo‘limga o‘tsangiz, kiritilgan o‘zgarishlar yo‘qoladi.')).toBeInTheDocument()

    // Click "O‘zgarishsiz davom etish"
    await user.click(screen.getByRole('button', { name: 'O‘zgarishsiz davom etish' }))

    // Dialog closes
    expect(screen.queryByText('O‘zgarishlar saqlanmagan')).not.toBeInTheDocument()
  })
})
