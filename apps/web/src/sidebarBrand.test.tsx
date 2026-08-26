import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
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
})
