import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StaffPage } from './pages/StaffPage'

vi.mock('./features/staff/staff.dependencies', () => {
  const mockMember = {
    id: 'staff-1',
    fullName: 'Alisher Karimov',
    login: 'a.karimov',
    phone: '+998 90 123 45 67',
    role: 'admin',
    position: 'Kassa administrator',
    status: 'active',
    salaryUzs: 4000000,
    lastSalaryPaidAt: null,
    createdAt: '2026-07-01',
  }
  return {
    staffRepository: {
      list: vi.fn().mockResolvedValue([mockMember]),
      create: vi.fn(),
      update: vi.fn(),
      setStatus: vi.fn(),
      payout: vi.fn().mockImplementation(async (_id: string, amount: number) => ({
        ...mockMember,
        lastSalaryPaidAt: new Date().toISOString(),
        salaryUzs: amount,
      })),
    },
  }
})

describe('Staff Salary Payout Flow Integration', () => {
  it('successfully executes Oylik berish payout without crashing and updates UI status', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <StaffPage />
      </QueryClientProvider>,
    )

    // Wait for staff member to appear in registry table
    await waitFor(() => {
      expect(screen.getByText('Alisher Karimov')).toBeInTheDocument()
    })

    // Click on row to open staff drawer
    await user.click(screen.getByText('Alisher Karimov'))

    // Verify initial salary status is "Oylik to‘lanmagan"
    expect(screen.getByText('Oylik to‘lanmagan')).toBeInTheDocument()

    // Click "Oylik berish" button in drawer
    const payoutButton = screen.getByRole('button', { name: /Oylik berish/i })
    await user.click(payoutButton)

    // Verify ConfirmDialog opens
    await waitFor(() => {
      expect(screen.getByRole('alertdialog', { name: /Xodim ish haqini berish/i })).toBeInTheDocument()
    })

    // Confirm payout
    const confirmButton = screen.getByRole('button', { name: 'Oylikni berish' })
    await user.click(confirmButton)

    // Verify success banner appears
    await waitFor(() => {
      expect(screen.getAllByText(/oylik berildi va Moliyaga o'tkazildi/i)[0]).toBeInTheDocument()
    })

    // Verify badge updated to "Ushbu oyda to‘langan" with Check icon without crashing
    await waitFor(() => {
      expect(screen.getByText(/Ushbu oyda to‘langan/i)).toBeInTheDocument()
    })
  })
})
