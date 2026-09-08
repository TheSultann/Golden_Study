import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeacherSalaryPage } from './TeacherSalaryPage'

const mockOverview = {
  teacherName: 'Alisher Karimov',
  pendingBalanceUzs: 1000000,
  totalPaidUzs: 3500000,
  salaryType: 'fixed' as const,
  salaryRate: 1000000,
  lastPaidAt: '2026-07-24T10:00:00.000Z',
  history: [
    {
      id: 'h1',
      date: '2026-09-08T14:06:00.000Z',
      amountUzs: 1000000,
      type: 'accrual' as const,
      status: 'pending' as const,
      title: 'Kutilayotgan maosh',
      comment: 'Hisoblangan maosh (to‘lov kutilmoqda)',
    },
    {
      id: 'h2',
      date: '2026-07-24T10:00:00.000Z',
      amountUzs: 1000000,
      type: 'payout' as const,
      status: 'paid' as const,
      title: 'Oylik to‘lovi',
      comment: 'Iyul oyi maoshi',
    },
  ],
}

vi.mock('../features/teacher-salary/teacherSalary.dependencies', () => ({
  teacherSalaryRepository: {
    getOverview: vi.fn(async () => mockOverview),
  },
}))

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <TeacherSalaryPage />
    </QueryClientProvider>,
  )
}

describe('TeacherSalaryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders stats cards with clean formatted numbers and badges', async () => {
    renderComponent()

    expect(await screen.findByText(/Alisher Karimov/)).toBeInTheDocument()

    // 4 stat cards
    expect(screen.getAllByText('Kutilayotgan maosh').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Jami to‘langan')).toBeInTheDocument()
    expect(screen.getByText('Stavka / Tarif')).toBeInTheDocument()
    expect(screen.getByText('Oxirgi to‘lov sanasi')).toBeInTheDocument()

    // Rate badge
    expect(screen.getByText('Oylik (Fiks)')).toBeInTheDocument()
  })

  it('renders history table and allows filtering by status and search', async () => {
    renderComponent()

    expect(await screen.findByRole('table', { name: 'Maosh tarixi' })).toBeInTheDocument()
    expect(screen.getByText('Oylik to‘lovi')).toBeInTheDocument()

    // Filter by "To'langan"
    const paidTab = screen.getByRole('button', { name: /To‘langan/ })
    fireEvent.click(paidTab)

    expect(screen.getByText('Oylik to‘lovi')).toBeInTheDocument()
    expect(screen.queryByText('Hisoblangan maosh (to‘lov kutilmoqda)')).not.toBeInTheDocument()

    // Search filter
    const searchInput = screen.getByPlaceholderText('Qidirish (izoh, summa)...')
    fireEvent.change(searchInput, { target: { value: 'Iyul' } })
    expect(screen.getByText('Iyul oyi maoshi')).toBeInTheDocument()
  })
})
