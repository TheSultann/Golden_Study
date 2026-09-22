import type { Group } from '@golden-study/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TelegramGroupConnectModal } from './TelegramGroupConnectModal'

const unlinkedGroup: Group = {
  id: 'g-test-123',
  name: 'General English B1',
  course: 'General English',
  teacher: 'John Doe',
  weekdays: ['Du', 'Chor', 'Ju'],
  time: '14:00',
  room: '101-xona',
  startDate: '2026-09-01',
  endDate: '2027-03-01',
  activeStudents: 12,
  graduateStudents: 0,
  active: true,
  telegramChatId: null,
  telegramChatTitle: null,
}

const linkedGroup: Group = {
  ...unlinkedGroup,
  id: 'g-test-456',
  name: 'IELTS Advanced',
  telegramChatId: '-100987654321',
  telegramChatTitle: 'IELTS Advanced Group Chat',
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

describe('TelegramGroupConnectModal', () => {
  it('renders connection instructions for unlinked group', () => {
    renderWithClient(
      <TelegramGroupConnectModal group={unlinkedGroup} onClose={vi.fn()} />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Telegram guruhni ulash/)).toBeInTheDocument()
    expect(screen.getByText(/General English B1 guruhi uchun/)).toBeInTheDocument()
    expect(screen.getByText(/1-usul: Havola orqali botni qo‘shish/)).toBeInTheDocument()
    expect(screen.getByText('/connect@Golden_StudyBot g-test-123')).toBeInTheDocument()
    expect(screen.getByText(/Maxfiylik kafolati:/)).toBeInTheDocument()
  })

  it('renders connected state for linked group', () => {
    renderWithClient(
      <TelegramGroupConnectModal group={linkedGroup} onClose={vi.fn()} />,
    )

    expect(screen.getByText(/Guruh muvaffaqiyatli bog‘langan/)).toBeInTheDocument()
    expect(screen.getByText(/IELTS Advanced Group Chat/)).toBeInTheDocument()
    expect(screen.getByText(/ID: -100987654321/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guruhni uzish/i })).toBeInTheDocument()
  })

  it('copies connection command to clipboard when copy button clicked', async () => {
    const user = userEvent.setup()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    })

    renderWithClient(
      <TelegramGroupConnectModal group={unlinkedGroup} onClose={vi.fn()} />,
    )

    const copyBtn = screen.getByRole('button', { name: /Nusxa olish/i })
    await user.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('/connect@Golden_StudyBot g-test-123')
  })

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup()
    const onCloseMock = vi.fn()
    renderWithClient(
      <TelegramGroupConnectModal group={unlinkedGroup} onClose={onCloseMock} />,
    )

    await user.keyboard('{Escape}')
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })
})
