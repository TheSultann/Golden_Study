import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LessonBroadcastModal } from './LessonBroadcastModal'

describe('LessonBroadcastModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    groupId: 'test-group-id',
    groupName: 'IELTS Band 7.5',
    date: '2026-09-21',
    initialTopic: 'Writing Task 2',
    initialHomework: 'Write 250 words essay',
    telegramChatId: '-10012345678',
    telegramChatTitle: 'IELTS Band 7.5 Group',
    onBroadcast: vi.fn(),
    isPending: false,
  }

  it('renders modal when open with initial topic and homework', () => {
    render(<LessonBroadcastModal {...defaultProps} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Dars xulosasini yuborish')).toBeInTheDocument()
    expect(screen.getByText(/IELTS Band 7.5 • 21.09.2026/)).toBeInTheDocument()

    // Inputs should be pre-filled
    expect(screen.getByDisplayValue('Writing Task 2')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Write 250 words essay')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<LessonBroadcastModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows error if topic and homework are cleared and user clicks send', async () => {
    render(<LessonBroadcastModal {...defaultProps} initialTopic="" initialHomework="" />)

    const sendBtn = screen.getByRole('button', { name: /Yuborish/i })
    expect(sendBtn).toBeDisabled()
  })

  it('switches between preview tabs showing public group view vs student view', async () => {
    const user = userEvent.setup()
    render(<LessonBroadcastModal {...defaultProps} />)

    // Initially in group view
    expect(screen.getByText(/Maxfiylik: O‘quvchilar ismlari, davomati yoki baholari guruhga chiqarilmaydi!/i)).toBeInTheDocument()

    // Switch to student view
    const studentTab = screen.getByRole('button', { name: /O‘quvchi xabari/i })
    await user.click(studentTab)

    expect(screen.getByText(/Davomat:/i)).toBeInTheDocument()
    expect(screen.getByText(/Baholar:/i)).toBeInTheDocument()
  })

  it('calls onBroadcast with correct parameters on send', async () => {
    const user = userEvent.setup()
    const onBroadcastMock = vi.fn().mockResolvedValue({
      success: true,
      groupChatSent: true,
      studentsSentCount: 5,
      totalActiveStudents: 5,
      telegramLinkedStudents: 5,
      nextLessonSummary: '23.09.2026, 09:00',
      message: 'Telegram guruhga va 5 ta o‘quvchiga yuborildi',
    })

    render(<LessonBroadcastModal {...defaultProps} onBroadcast={onBroadcastMock} />)

    const sendBtn = screen.getByRole('button', { name: /Yuborish/i })
    await user.click(sendBtn)

    expect(onBroadcastMock).toHaveBeenCalledWith({
      sendToGroupChat: true,
      sendToStudents: true,
      topic: 'Writing Task 2',
      homeworkText: 'Write 250 words essay',
    })

    await waitFor(() => {
      expect(screen.getByText('Dars xulosasi muvaffaqiyatli yuborildi!')).toBeInTheDocument()
      expect(screen.getByText(/Telegram guruhga va 5 ta o‘quvchiga yuborildi/)).toBeInTheDocument()
      expect(screen.getByText(/23.09.2026, 09:00/)).toBeInTheDocument()
    })
  })

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup()
    const onCloseMock = vi.fn()
    render(<LessonBroadcastModal {...defaultProps} onClose={onCloseMock} />)

    await user.keyboard('{Escape}')
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })
})
