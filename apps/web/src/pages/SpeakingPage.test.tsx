import type { SpeakingSubmission, SpeakingTopic } from '@golden-study/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SpeakingPage } from './SpeakingPage'
import { getSubmissionAudioUrl } from '../features/speaking/speaking.utils'

const mockGroups = [
  { id: 'g-1', name: 'IELTS Band 7.5', active: true },
  { id: 'g-2', name: 'General English B2', active: true },
]

const mockTopics: SpeakingTopic[] = [
  {
    id: 'top-1',
    groupId: 'g-1',
    groupName: 'IELTS Band 7.5',
    teacherId: 't-1',
    title: 'Speaking amaliyoti',
    description: 'O‘quvchilarning og‘zaki nutq amaliyoti va ovozli topshiriqlari',
    maxScore: 10,
    deadline: null,
    createdAt: '2026-11-01T10:00:00.000Z',
  },
]

const mockSubmissions: SpeakingSubmission[] = [
  {
    id: 'sub-1',
    topicId: 'top-1',
    studentId: 'st-1',
    studentName: 'Bobur Karimov',
    studentCode: 'SPK101',
    audioUrl: 'https://cdn.example.com/audio/sample.mp3',
    durationSeconds: 45,
    transcript: 'Well, I would like to talk about my journey to Samarkand...',
    aiFeedback: '## 📊 IELTS Speaking Tahlili (Band 7.0)\n\n### 📝 Grammatika\nAjoyib talaffuz va boy so‘z boyligi.',
    aiScore: 7.0,
    teacherScore: null,
    teacherComment: null,
    status: 'EVALUATED_BY_AI',
    createdAt: '2026-11-02T12:00:00.000Z',
  },
]

const mockGradeSubmission = vi.fn(async () => ({
  ...mockSubmissions[0]!,
  teacherScore: 8.5,
  teacherComment: 'Juda ajoyib nutq!',
  status: 'GRADED_BY_TEACHER' as const,
}))

const mockSubmitRecording = vi.fn(async (input) => ({
  id: 'sub-new',
  topicId: input.topicId,
  studentId: input.studentId,
  studentName: 'Bobur Karimov',
  studentCode: 'SPK101',
  audioUrl: input.audioUrl,
  durationSeconds: input.durationSeconds,
  transcript: 'Transcript',
  aiFeedback: 'Feedback',
  aiScore: 7.0,
  teacherScore: null,
  teacherComment: null,
  status: 'EVALUATED_BY_AI',
  createdAt: new Date().toISOString(),
}))

const mockGradeStudent = vi.fn(async (input: any) => ({
  ...mockSubmissions[0]!,
  id: 'sub-graded-student',
  studentId: input.studentId,
  teacherScore: input.teacherScore,
  teacherComment: input.teacherComment,
  status: 'GRADED_BY_TEACHER' as const,
}))

const mockListSubmissions = vi.fn(async () => mockSubmissions)

vi.mock('../features/speaking/speaking.dependencies', () => ({
  speakingRepository: {
    listTopics: vi.fn(async () => mockTopics),
    createTopic: vi.fn(),
    listSubmissions: () => mockListSubmissions(),
    gradeSubmission: (...args: unknown[]) => (mockGradeSubmission as (...a: unknown[]) => unknown)(...args),
    gradeStudent: (...args: unknown[]) => (mockGradeStudent as (...a: unknown[]) => unknown)(...args),
    submitRecording: (...args: unknown[]) => (mockSubmitRecording as (...a: unknown[]) => unknown)(...args),
  },
}))

vi.mock('../features/groups/group.dependencies', () => ({
  groupRepository: {
    list: vi.fn(async () => mockGroups),
    listStudents: vi.fn(async (groupId: string) => {
      if (groupId === 'g-2') {
        return [
          { id: 'st-2', firstName: 'Dilnoza', lastName: 'Aliyeva', code: 'SPK201', status: 'active' },
        ]
      }
      return [
        { id: 'st-1', firstName: 'Bobur', lastName: 'Karimov', code: 'SPK101', status: 'active' },
      ]
    }),
  },
}))

vi.mock('../features/teacher-exams/teacherExams.dependencies', () => ({
  teacherExamRepository: {
    listGroups: vi.fn(async () => mockGroups.map((g) => ({ ...g, studentCount: 15, teacherId: 't-1' }))),
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
      <SpeakingPage />
    </QueryClientProvider>,
  )
}

describe('SpeakingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListSubmissions.mockImplementation(async () => mockSubmissions)
  })

  it('renders isolated Speaking Leaderboard in left column instead of old Mavzular list', async () => {
    renderComponent()

    expect(await screen.findByText('Speaking & IELTS Voice Lab')).toBeInTheDocument()

    // Left sidebar should render "Speaking reytingi", NOT "Mavzular"
    expect(await screen.findByRole('heading', { name: /Speaking reytingi/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Mavzular/i })).not.toBeInTheDocument()

    // Group info and scale
    await vi.waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Guruh' })).toHaveValue('g-1')
    })
    expect(screen.getAllByText('IELTS Band 7.5').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Max: 10').length).toBeGreaterThanOrEqual(1)

    // Ranked student in left leaderboard
    const rankingCard = await screen.findByRole('button', { name: /Bobur Karimov speaking progressi/ })
    expect(rankingCard).toBeInTheDocument()
    expect(within(rankingCard).getByText('Bobur Karimov')).toBeInTheDocument()
    expect(within(rankingCard).getByText('#SPK101')).toBeInTheDocument()
    expect(within(rankingCard).getByText('7')).toBeInTheDocument() // Average score
    expect(within(rankingCard).getByText('1 ta baho')).toBeInTheDocument()
  })

  it('does NOT render topic creation button or modal', async () => {
    renderComponent()

    expect(await screen.findByText('Speaking & IELTS Voice Lab')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Yangi mavzu qo‘shish/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Yangi Speaking mavzusi')).not.toBeInTheDocument()
  })

  it('opens Student Speaking Progress modal upon clicking a student in the leaderboard', async () => {
    renderComponent()

    expect(await screen.findByText('Speaking reytingi (1)')).toBeInTheDocument()

    // Click student in leaderboard
    const rankingBtn = screen.getByRole('button', { name: /Bobur Karimov speaking progressi/ })
    fireEvent.click(rankingBtn)

    // Modal opens
    const modal = await screen.findByRole('dialog')
    expect(modal).toBeInTheDocument()
    expect(within(modal).getByText('Bobur Karimov — Speaking progressi')).toBeInTheDocument()
    expect(within(modal).getByText('#SPK101')).toBeInTheDocument()
    expect(within(modal).getByText('IELTS Band 7.5')).toBeInTheDocument()

    // Key metrics in modal
    expect(within(modal).queryByText(/Guruhdagi o‘rni/)).not.toBeInTheDocument()
    expect(within(modal).getByText(/O‘rtacha ball/)).toBeInTheDocument()
    expect(within(modal).getAllByText('7 / 10').length).toBeGreaterThanOrEqual(1)
    expect(within(modal).getByText(/Eng yuqori/)).toBeInTheDocument()
    expect(within(modal).getByText('1 ta audio')).toBeInTheDocument()
    expect(within(modal).getByText('Baholandi')).toBeInTheDocument()

    // Timeline present, audio history block removed per design
    expect(within(modal).getByText('Ballar dinamikasi (1)')).toBeInTheDocument()
    expect(within(modal).queryByText(/Ovozli topshiriqlar tarixi/)).not.toBeInTheDocument()

    // Close modal
    const closeBtn = within(modal).getAllByRole('button', { name: 'Yopish' })[0]!
    fireEvent.click(closeBtn)
    expect(screen.queryByText('Bobur Karimov — Speaking progressi')).not.toBeInTheDocument()
  })

  it('does NOT render Lentada filtrlash button in progress modal footer', async () => {
    renderComponent()

    expect(await screen.findByText('Speaking reytingi (1)')).toBeInTheDocument()

    // Open progress modal
    fireEvent.click(screen.getByRole('button', { name: /Bobur Karimov speaking progressi/ }))
    const modal = await screen.findByRole('dialog')
    expect(modal).toBeInTheDocument()
    expect(within(modal).getByText('Bobur Karimov — Speaking progressi')).toBeInTheDocument()

    // Button "Lentada filtrlash" should NOT exist in footer
    expect(within(modal).queryByRole('button', { name: 'Lentada filtrlash' })).not.toBeInTheDocument()

    // Header close X and footer primary button are present
    const closeButtons = within(modal).getAllByRole('button', { name: 'Yopish' })
    expect(closeButtons.length).toBe(2)

    // Close modal via footer button
    fireEvent.click(closeButtons[1]!)
    expect(screen.queryByText('Bobur Karimov — Speaking progressi')).not.toBeInTheDocument()
  })

  it('renders glowing group badge and right-aligned max score pill without Speaking amaliyoti title', async () => {
    renderComponent()

    await screen.findByText('Speaking & IELTS Voice Lab')
    await vi.waitFor(() => {
      const tag = document.querySelector('.speaking-tag-glowing')
      expect(tag).not.toBeNull()
      expect(tag).toHaveTextContent('IELTS Band 7.5')
      expect(tag?.querySelector('.speaking-tag-sparkle')).not.toBeNull()
    })

    // Title and subtitle must NOT be rendered in review column
    expect(screen.queryByRole('heading', { name: 'Speaking amaliyoti' })).not.toBeInTheDocument()
    expect(screen.queryByText(/O‘quvchilarning og‘zaki nutq amaliyoti, Gemini AI tahlili/)).not.toBeInTheDocument()

    // Maksimal ball pill must be present in right-aligned review container
    const rightContainer = document.querySelector('.speaking-review-right')
    expect(rightContainer).not.toBeNull()
    expect(within(rightContainer as HTMLElement).getByText('Maksimal ball:')).toBeInTheDocument()
    expect(within(rightContainer as HTMLElement).getByText('10')).toBeInTheDocument()

    // Filter tabs are in review bottom
    const reviewBottom = document.querySelector('.speaking-review-bottom')
    expect(reviewBottom).not.toBeNull()
    expect(within(reviewBottom as HTMLElement).getByRole('tab', { name: 'Barchasi' })).toBeInTheDocument()
  })

  it('opens Student Speaking Progress modal from submission card Progress button', async () => {
    renderComponent()

    expect((await screen.findAllByText('Bobur Karimov')).length).toBeGreaterThanOrEqual(1)

    const progressBtn = screen.getByRole('button', { name: /Bobur Karimov progressini ko‘rish/ })
    fireEvent.click(progressBtn)

    expect(await screen.findByText('Bobur Karimov — Speaking progressi')).toBeInTheDocument()
  })

  it('renders submission cards with audio player and AI feedback badge', async () => {
    renderComponent()

    expect((await screen.findAllByText('Bobur Karimov')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('#SPK101').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('AI Baholagan')).toBeInTheDocument()

    // HTML5 Audio Player
    const audioPlayer = document.querySelector('audio')
    expect(audioPlayer).toBeInTheDocument()
    expect(audioPlayer?.getAttribute('src')).toBe('https://cdn.example.com/audio/sample.mp3')

    // AI score & transcript toggle button
    const toggleButton = screen.getByRole('button', { name: /Gemini AI Tahlili/ })
    expect(toggleButton).toBeInTheDocument()
    expect(screen.getByText(/Gemini AI Tahlili & Transkript \(Band 7\)/)).toBeInTheDocument()

    // Expand transcript
    fireEvent.click(toggleButton)
    expect(screen.getAllByText(/"Well, I would like to talk about my journey to Samarkand\.\.\."/).length).toBeGreaterThanOrEqual(1)
  })

  it('toggles AI feedback accordion visibility and restores card position on collapse', async () => {
    const scrollIntoViewMock = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

    renderComponent()

    expect((await screen.findAllByText('Bobur Karimov')).length).toBeGreaterThanOrEqual(1)
    const toggleButton = screen.getByRole('button', { name: /Gemini AI Tahlili/ })

    // Collapsed by default in submission card
    expect(screen.queryByText(/"Well, I would like to talk about my journey to Samarkand\.\.\."/)).not.toBeInTheDocument()

    // Click to expand -> shows transcript
    fireEvent.click(toggleButton)
    expect(screen.getByText(/"Well, I would like to talk about my journey to Samarkand\.\.\."/)).toBeInTheDocument()

    // Click bottom "Yopish" collapse button -> closes transcript and returns to card position
    const closeBtn = screen.getByRole('button', { name: /Transkriptni yopish/ })
    fireEvent.click(closeBtn)
    expect(screen.queryByText(/"Well, I would like to talk about my journey to Samarkand\.\.\."/)).not.toBeInTheDocument()
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth', block: 'nearest' }),
    )

    // Click again to re-open
    fireEvent.click(toggleButton)
    expect(screen.getByText(/"Well, I would like to talk about my journey to Samarkand\.\.\."/)).toBeInTheDocument()

    // Click top toggle button to collapse -> also returns smoothly to card
    scrollIntoViewMock.mockClear()
    fireEvent.click(toggleButton)
    expect(screen.queryByText(/"Well, I would like to talk about my journey to Samarkand\.\.\."/)).not.toBeInTheDocument()
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth', block: 'nearest' }),
    )
  })

  it('normalizes Uzbek apostrophes when searching by student name', async () => {
    mockListSubmissions.mockImplementation(async () => [
      {
        ...mockSubmissions[0]!,
        id: 'sub-uzb',
        studentName: 'Yo‘ldoshev G‘ayrat',
      },
    ])
    renderComponent()

    expect((await screen.findAllByText('Yo‘ldoshev G‘ayrat')).length).toBeGreaterThanOrEqual(1)

    const searchInput = screen.getByLabelText('Qidirish')
    // Search with straight keyboard apostrophe
    fireEvent.change(searchInput, { target: { value: "Yo'ldoshev" } })
    expect(screen.getAllByText('Yo‘ldoshev G‘ayrat').length).toBeGreaterThanOrEqual(1)

    // Search with G'ayrat
    fireEvent.change(searchInput, { target: { value: "g'ayrat" } })
    expect(screen.getAllByText('Yo‘ldoshev G‘ayrat').length).toBeGreaterThanOrEqual(1)
  })

  it('renders Nutq transkripti label for transcript-only submission without AI feedback', async () => {
    mockListSubmissions.mockImplementation(async () => [
      {
        ...mockSubmissions[0]!,
        id: 'sub-transcript-only',
        transcript: 'Salom, bu sinov transkripti.',
        aiFeedback: '',
        aiScore: null,
      },
    ])
    renderComponent()

    expect((await screen.findAllByText('Bobur Karimov')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Nutq transkripti')).toBeInTheDocument()
    expect(screen.queryByText(/Gemini AI Tahlili/)).not.toBeInTheDocument()

    // Expand transcript
    const toggleButton = screen.getByRole('button', { name: /Nutq transkripti/ })
    fireEvent.click(toggleButton)
    expect(screen.getByText(/"Salom, bu sinov transkripti\."/)).toBeInTheDocument()
  })

  it('does not render accordion when submission has neither transcript nor AI feedback', async () => {
    mockListSubmissions.mockImplementation(async () => [
      {
        ...mockSubmissions[0]!,
        id: 'sub-empty-transcript',
        transcript: '',
        aiFeedback: '',
        aiScore: null,
      },
    ])
    renderComponent()

    expect((await screen.findAllByText('Bobur Karimov')).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('button', { name: /Transkriptni ko‘rish/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Nutq transkripti/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Gemini AI Tahlili/)).not.toBeInTheDocument()
  })

  it('filters submissions by search input located in the review header', async () => {
    renderComponent()

    expect((await screen.findAllByText('Bobur Karimov')).length).toBeGreaterThanOrEqual(1)

    const searchInput = screen.getByLabelText('Qidirish')
    fireEvent.change(searchInput, { target: { value: 'nonexistent-student' } })

    expect(screen.queryByText('Bobur Karimov')).not.toBeInTheDocument()
    expect(screen.getByText('Filtrga mos topshiriq topilmadi.')).toBeInTheDocument()

    // Search by code without hash
    fireEvent.change(searchInput, { target: { value: 'SPK101' } })
    expect(screen.getAllByText('Bobur Karimov').length).toBeGreaterThanOrEqual(1)

    // Search by code with hash (#SPK101)
    fireEvent.change(searchInput, { target: { value: '#SPK101' } })
    expect(screen.getAllByText('Bobur Karimov').length).toBeGreaterThanOrEqual(1)
  })

  it('filters submissions by status tabs with counts in review header', async () => {
    renderComponent()

    expect((await screen.findAllByText('Bobur Karimov')).length).toBeGreaterThanOrEqual(1)

    // Verify status tabs with counts
    expect(screen.getByRole('tab', { name: 'Barchasi' })).toHaveTextContent('Barchasi(1)')
    expect(screen.getByRole('tab', { name: 'Kutilmoqda' })).toHaveTextContent('Kutilmoqda(0)')
    expect(screen.getByRole('tab', { name: 'AI baholagan' })).toHaveTextContent('AI baholagan(1)')
    expect(screen.getByRole('tab', { name: 'Baholandi' })).toHaveTextContent('Baholandi(0)')

    // Click 'Kutilmoqda' -> submission has status EVALUATED_BY_AI, so it shouldn't show in feed
    const pendingTab = screen.getByRole('tab', { name: 'Kutilmoqda' })
    fireEvent.click(pendingTab)
    expect(screen.getByText('Filtrga mos topshiriq topilmadi.')).toBeInTheDocument()

    // Click 'AI baholagan' -> submission shows
    const aiTab = screen.getByRole('tab', { name: 'AI baholagan' })
    fireEvent.click(aiTab)
    expect(screen.getAllByText('Bobur Karimov').length).toBeGreaterThanOrEqual(1)

    // Click 'Barchasi' -> submission shows
    const allTab = screen.getByRole('tab', { name: 'Barchasi' })
    fireEvent.click(allTab)
    expect(screen.getAllByText('Bobur Karimov').length).toBeGreaterThanOrEqual(1)
  })

  it('opens teacher grading modal and submits evaluation on a fixed 10 scale', async () => {
    renderComponent()

    expect((await screen.findAllByText('Bobur Karimov')).length).toBeGreaterThanOrEqual(1)

    // Click "Baholash" button
    const gradeButton = screen.getByRole('button', { name: /Baholash/ })
    fireEvent.click(gradeButton)

    // Modal opens
    expect(await screen.findByText('O‘quvchi nutqini baholash')).toBeInTheDocument()
    expect(screen.getByText(/O‘qituvchi bali \(Max: 10\)/)).toBeInTheDocument()

    // Change score to valid 8.5
    const scoreInput = screen.getByLabelText(/O‘qituvchi bali/)
    fireEvent.change(scoreInput, { target: { value: '8.5' } })

    const commentInput = screen.getByLabelText(/O‘qituvchi izohi/)
    fireEvent.change(commentInput, { target: { value: 'Juda ajoyib nutq!' } })

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Bahoni tasdiqlash/ })
    fireEvent.submit(submitBtn.closest('form')!)

    await vi.waitFor(() => {
      expect(mockGradeSubmission).toHaveBeenCalledWith(
        'sub-1',
        expect.objectContaining({
          teacherScore: 8.5,
          teacherComment: 'Juda ajoyib nutq!',
        }),
      )
    })
  })

  it('validates score exceeding 10 in grading modal', async () => {
    renderComponent()

    expect((await screen.findAllByText('Bobur Karimov')).length).toBeGreaterThanOrEqual(1)

    const gradeButton = screen.getByRole('button', { name: /Baholash/ })
    fireEvent.click(gradeButton)

    expect(await screen.findByText('O‘quvchi nutqini baholash')).toBeInTheDocument()

    const scoreInput = screen.getByLabelText(/O‘qituvchi bali/)
    fireEvent.change(scoreInput, { target: { value: '11' } })

    const submitBtn = screen.getByRole('button', { name: /Bahoni tasdiqlash/ })
    fireEvent.submit(submitBtn.closest('form')!)

    expect(await screen.findByText(/Ball 0 va 10 oralig‘ida bo‘lishi lozim/)).toBeInTheDocument()
    expect(mockGradeSubmission).not.toHaveBeenCalled()
  })

  it('closes grade modal on Escape key press and backdrop click', async () => {
    renderComponent()

    expect((await screen.findAllByText('Bobur Karimov')).length).toBeGreaterThanOrEqual(1)

    const gradeButton = screen.getByRole('button', { name: /Baholash/ })
    fireEvent.click(gradeButton)

    expect(await screen.findByText('O‘quvchi nutqini baholash')).toBeInTheDocument()

    // Press Escape -> Modal closes
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('O‘quvchi nutqini baholash')).not.toBeInTheDocument()

    // Open again and click backdrop -> Modal closes
    fireEvent.click(gradeButton)
    expect(await screen.findByText('O‘quvchi nutqini baholash')).toBeInTheDocument()

    const backdrop = document.querySelector('.modal-backdrop')
    expect(backdrop).toBeInTheDocument()
    fireEvent.click(backdrop!)
    expect(screen.queryByText('O‘quvchi nutqini baholash')).not.toBeInTheDocument()
  })

  it('renders and toggles transcript preview inside Grade modal', async () => {
    renderComponent()

    expect((await screen.findAllByText('Bobur Karimov')).length).toBeGreaterThanOrEqual(1)

    const gradeButton = screen.getByRole('button', { name: /Baholash/ })
    fireEvent.click(gradeButton)

    const modal = await screen.findByRole('dialog')
    expect(modal).toBeInTheDocument()
    expect(within(modal).getByText(/Nutq transkripti:/)).toBeInTheDocument()
    expect(within(modal).getByText(/"Well, I would like to talk about my journey to Samarkand\.\.\."/)).toBeInTheDocument()

    // Collapse transcript in modal
    const toggleBtn = within(modal).getByRole('button', { name: /Transkriptni yopish/ })
    fireEvent.click(toggleBtn)
    expect(within(modal).queryByText(/"Well, I would like to talk about my journey to Samarkand\.\.\."/)).not.toBeInTheDocument()

    // Re-open transcript in modal
    const openBtn = within(modal).getByRole('button', { name: /Transkriptni ko‘rish/ })
    fireEvent.click(openBtn)
    expect(within(modal).getByText(/"Well, I would like to talk about my journey to Samarkand\.\.\."/)).toBeInTheDocument()
  })

  it('resolves audio URL to streaming endpoint for telegram references and direct for external audio', () => {
    const telegramSub: SpeakingSubmission = {
      ...mockSubmissions[0]!,
      id: 'sub-telegram-99',
      audioUrl: 'telegram:voice_file_abc123',
    }
    const streamingUrl = getSubmissionAudioUrl(telegramSub)
    expect(streamingUrl).toContain('/api/v1/speaking/submissions/sub-telegram-99/audio')

    const directSub: SpeakingSubmission = {
      ...mockSubmissions[0]!,
      id: 'sub-direct-1',
      audioUrl: 'https://cdn.example.com/audio/direct.mp3',
    }
    expect(getSubmissionAudioUrl(directSub)).toBe('https://cdn.example.com/audio/direct.mp3')
  })

  it('unrated student does NOT receive medals and shows as unrated in leaderboard and modal', async () => {
    const { groupRepository } = await import('../features/groups/group.dependencies')
    vi.mocked(groupRepository.listStudents).mockResolvedValueOnce([
      { id: 'st-1', firstName: 'Bobur', lastName: 'Karimov', code: 'SPK101', status: 'active', birthDate: '', phone: '', parentName: '', parentPhone: '', address: '', balance: 0, groups: ['g-1'] },
      { id: 'st-unrated', firstName: 'Jasur', lastName: 'Valiyev', code: 'SPK999', status: 'active', birthDate: '', phone: '', parentName: '', parentPhone: '', address: '', balance: 0, groups: ['g-1'] },
    ])

    renderComponent()

    expect(await screen.findByText('Speaking reytingi (2)')).toBeInTheDocument()

    // Bobur has score 7.0 -> Rank 1 with clean numeric badge
    const boburCard = await screen.findByRole('button', { name: /Bobur Karimov speaking progressi/ })
    expect(within(boburCard).getByText('1')).toBeInTheDocument()
    expect(within(boburCard).getByText('7')).toBeInTheDocument()

    // Jasur has no submissions -> Unrated, must have '—'
    const jasurCard = await screen.findByRole('button', { name: /Jasur Valiyev speaking progressi/ })
    expect(within(jasurCard).getByText('—')).toBeInTheDocument()
    expect(within(jasurCard).queryByText('1')).not.toBeInTheDocument()
    expect(within(jasurCard).getByText('Topshirilmagan')).toBeInTheDocument()

    // Open Jasur's modal -> shows unrated progress stats without Guruhdagi o'rni
    fireEvent.click(jasurCard)
    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByText('Jasur Valiyev — Speaking progressi')).toBeInTheDocument()
    expect(within(modal).queryByText(/Guruhdagi o‘rni/)).not.toBeInTheDocument()
    expect(within(modal).getByText('0 ta audio')).toBeInTheDocument()
    expect(within(modal).getByText('0 ta')).toBeInTheDocument()
  })

  it('searching preserves student true rank instead of resetting it to 1st place', async () => {
    const { groupRepository } = await import('../features/groups/group.dependencies')
    vi.mocked(groupRepository.listStudents).mockResolvedValueOnce([
      { id: 'st-1', firstName: 'Bobur', lastName: 'Karimov', code: 'SPK101', status: 'active', birthDate: '', phone: '', parentName: '', parentPhone: '', address: '', balance: 0, groups: ['g-1'] },
      { id: 'st-2', firstName: 'Malika', lastName: 'Rahimova', code: 'SPK102', status: 'active', birthDate: '', phone: '', parentName: '', parentPhone: '', address: '', balance: 0, groups: ['g-1'] },
    ])
    mockListSubmissions.mockResolvedValueOnce([
      { ...mockSubmissions[0]!, studentId: 'st-1', studentName: 'Bobur Karimov', teacherScore: 8.5 },
      { ...mockSubmissions[0]!, id: 'sub-2', studentId: 'st-2', studentName: 'Malika Rahimova', studentCode: 'SPK102', teacherScore: 6.5 },
    ])

    renderComponent()

    expect(await screen.findByText('Speaking reytingi (2)')).toBeInTheDocument()

    // Before search: Bobur is #1, Malika is #2
    const initialMalika = screen.getByRole('button', { name: /Malika Rahimova speaking progressi/ })
    expect(within(initialMalika).getByText('2')).toBeInTheDocument()

    // Search for "Malika"
    const searchInput = screen.getByLabelText('Qidirish')
    fireEvent.change(searchInput, { target: { value: 'Malika' } })

    // Malika is now the sole entry visible in leaderboard, but her rank MUST still be 2!
    const filteredMalika = screen.getByRole('button', { name: /Malika Rahimova speaking progressi/ })
    expect(within(filteredMalika).getByText('2')).toBeInTheDocument()
    expect(within(filteredMalika).queryByText('1')).not.toBeInTheDocument()
  })

  it('renders score dynamics progression in chronological order with latest indicator', async () => {
    const { groupRepository } = await import('../features/groups/group.dependencies')
    vi.mocked(groupRepository.listStudents).mockResolvedValueOnce([
      { id: 'st-1', firstName: 'Bobur', lastName: 'Karimov', code: 'SPK101', status: 'active', birthDate: '', phone: '', parentName: '', parentPhone: '', address: '', balance: 0, groups: ['g-1'] },
    ])
    mockListSubmissions.mockResolvedValueOnce([
      // Newest submission first in API feed
      { ...mockSubmissions[0]!, id: 'sub-newer', createdAt: '2026-11-06T12:00:00.000Z', teacherScore: 9.0 },
      // Older submission
      { ...mockSubmissions[0]!, id: 'sub-older', createdAt: '2026-11-01T12:00:00.000Z', teacherScore: 6.5 },
    ])

    renderComponent()

    expect(await screen.findByText('Speaking reytingi (1)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Bobur Karimov speaking progressi/ }))

    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByText('Ballar dinamikasi (2)')).toBeInTheDocument()

    const timelineItems = modal.querySelectorAll('.speaking-timeline-item')
    expect(timelineItems).toHaveLength(2)

    // First item in timeline must be the newer submission (06.11.2026, 9 / 10) with (so‘nggi) at the top
    expect(timelineItems[0]).toHaveTextContent('06.11.2026')
    expect(timelineItems[0]).toHaveTextContent('9 / 10')
    expect(timelineItems[0]).toHaveTextContent('(so‘nggi)')

    // Second item must be the older submission (01.11.2026, 6.5 / 10) below it
    expect(timelineItems[1]).toHaveTextContent('01.11.2026')
    expect(timelineItems[1]).toHaveTextContent('6.5 / 10')
  })

  it('does NOT call listTopics on mount as legacy topics are retired', async () => {
    const { speakingRepository } = await import('../features/speaking/speaking.dependencies')
    renderComponent()

    await screen.findByText('Speaking & IELTS Voice Lab')
    expect(speakingRepository.listTopics).not.toHaveBeenCalled()
  })

  it('renders graceful empty state when no groups exist in the center', async () => {
    const { groupRepository } = await import('../features/groups/group.dependencies')
    vi.mocked(groupRepository.list).mockResolvedValueOnce([])

    renderComponent()

    expect(await screen.findByText('Speaking & IELTS Voice Lab')).toBeInTheDocument()
    expect(await screen.findByText('Hozircha guruhlar mavjud emas.')).toBeInTheDocument()
    expect(screen.getByText('Topshiriqlarni ko‘rish uchun avval guruh tanlang yoki yarating.')).toBeInTheDocument()
  })

  it('renders unsubmitted students in a compact row format instead of large cards with repeated text', async () => {
    const { groupRepository } = await import('../features/groups/group.dependencies')
    vi.mocked(groupRepository.listStudents).mockResolvedValueOnce([
      { id: 'st-1', firstName: 'Bobur', lastName: 'Karimov', code: 'SPK101', status: 'active', birthDate: '', phone: '', parentName: '', parentPhone: '', address: '', balance: 0, groups: ['g-1'] },
      { id: 'st-2', firstName: 'Dilnoza', lastName: 'Aliyeva', code: 'SPK201', status: 'active', birthDate: '', phone: '', parentName: '', parentPhone: '', address: '', balance: 0, groups: ['g-1'] },
      { id: 'st-3', firstName: 'Javohir', lastName: 'Toshtemirov', code: 'SPK202', status: 'active', birthDate: '', phone: '', parentName: '', parentPhone: '', address: '', balance: 0, groups: ['g-1'] },
    ])

    renderComponent()

    expect(await screen.findByText('Speaking & IELTS Voice Lab')).toBeInTheDocument()

    // 1 submission for Bobur Karimov, 2 unsubmitted students (Dilnoza, Javohir)
    expect(await screen.findByText('Audio topshirmagan o‘quvchilar')).toBeInTheDocument()
    expect(screen.getByText('(2)')).toBeInTheDocument()

    // The repetitive warning text must NOT be rendered repeatedly
    expect(screen.queryByText(/Audio topshirilmagan\. O‘quvchi sinfda/)).not.toBeInTheDocument()

    // Unsubmitted rows exist with compact class and contents
    const unsubmittedRows = document.querySelectorAll('.speaking-unsubmitted-row')
    expect(unsubmittedRows.length).toBe(2)

    // Check Dilnoza row
    const dilnozaRow = unsubmittedRows[0]!
    expect(within(dilnozaRow as HTMLElement).getByText('Dilnoza Aliyeva')).toBeInTheDocument()
    expect(within(dilnozaRow as HTMLElement).getByText('#SPK201')).toBeInTheDocument()
    expect(within(dilnozaRow as HTMLElement).getByText('Topshirmagan')).toBeInTheDocument()
    expect(within(dilnozaRow as HTMLElement).getByRole('button', { name: /Dilnoza Aliyeva progressini ko‘rish/ })).toBeInTheDocument()
    expect(within(dilnozaRow as HTMLElement).getByRole('button', { name: /Dilnoza Aliyeva nutqini baholash/ })).toBeInTheDocument()

    // Check Javohir row
    const javohirRow = unsubmittedRows[1]!
    expect(within(javohirRow as HTMLElement).getByText('Javohir Toshtemirov')).toBeInTheDocument()
    expect(within(javohirRow as HTMLElement).getByText('#SPK202')).toBeInTheDocument()
  })

  it('opens teacher grading modal from unsubmitted student row and submits direct grade', async () => {
    const { groupRepository } = await import('../features/groups/group.dependencies')
    vi.mocked(groupRepository.listStudents).mockResolvedValueOnce([
      { id: 'st-1', firstName: 'Bobur', lastName: 'Karimov', code: 'SPK101', status: 'active', birthDate: '', phone: '', parentName: '', parentPhone: '', address: '', balance: 0, groups: ['g-1'] },
      { id: 'st-2', firstName: 'Dilnoza', lastName: 'Aliyeva', code: 'SPK201', status: 'active', birthDate: '', phone: '', parentName: '', parentPhone: '', address: '', balance: 0, groups: ['g-1'] },
    ])

    renderComponent()

    expect(await screen.findByText('Speaking & IELTS Voice Lab')).toBeInTheDocument()

    // Click "Baholash" on Dilnoza's row
    const gradeBtn = await screen.findByRole('button', { name: /Dilnoza Aliyeva nutqini baholash/ })
    fireEvent.click(gradeBtn)

    // Modal opens for Dilnoza
    expect(await screen.findByText('O‘quvchi nutqini baholash')).toBeInTheDocument()
    expect(screen.getByText('Dilnoza Aliyeva (#SPK201)')).toBeInTheDocument()

    // Enter score 9.0 and comment
    const scoreInput = screen.getByLabelText(/O‘qituvchi bali/)
    fireEvent.change(scoreInput, { target: { value: '9' } })

    const commentInput = screen.getByLabelText(/O‘qituvchi izohi/)
    fireEvent.change(commentInput, { target: { value: 'Sinfdagi faol nutq uchun' } })

    const submitBtn = screen.getByRole('button', { name: /Bahoni tasdiqlash/ })
    fireEvent.submit(submitBtn.closest('form')!)

    await vi.waitFor(() => {
      expect(mockGradeStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'st-2',
          groupId: 'g-1',
          teacherScore: 9,
          teacherComment: 'Sinfdagi faol nutq uchun',
        }),
      )
    })
  })

  it('opens Student Speaking Progress modal from unsubmitted student row Progress button', async () => {
    const { groupRepository } = await import('../features/groups/group.dependencies')
    vi.mocked(groupRepository.listStudents).mockResolvedValueOnce([
      { id: 'st-1', firstName: 'Bobur', lastName: 'Karimov', code: 'SPK101', status: 'active', birthDate: '', phone: '', parentName: '', parentPhone: '', address: '', balance: 0, groups: ['g-1'] },
      { id: 'st-2', firstName: 'Dilnoza', lastName: 'Aliyeva', code: 'SPK201', status: 'active', birthDate: '', phone: '', parentName: '', parentPhone: '', address: '', balance: 0, groups: ['g-1'] },
    ])

    renderComponent()

    expect(await screen.findByText('Speaking & IELTS Voice Lab')).toBeInTheDocument()

    const progressBtn = await screen.findByRole('button', { name: /Dilnoza Aliyeva progressini ko‘rish/ })
    fireEvent.click(progressBtn)

    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByText('Dilnoza Aliyeva — Speaking progressi')).toBeInTheDocument()
    expect(within(modal).getByText('#SPK201')).toBeInTheDocument()
    expect(within(modal).getByText('0 ta audio')).toBeInTheDocument()
  })

  it('renders clean compact unsubmitted table when entire group of 16 students has 0 audio submissions', async () => {
    const { groupRepository } = await import('../features/groups/group.dependencies')
    // 16 students enrolled
    const sixteenStudents = Array.from({ length: 16 }, (_, i) => ({
      id: `st-cohort-${i + 1}`,
      firstName: `Talaba_${i + 1}`,
      lastName: `Familiya_${i + 1}`,
      code: `SPK${100 + i + 1}`,
      status: 'active' as const,
      birthDate: '',
      phone: '',
      parentName: '',
      parentPhone: '',
      address: '',
      balance: 0,
      groups: ['g-1'],
    }))

    vi.mocked(groupRepository.listStudents).mockResolvedValueOnce(sixteenStudents)
    // 0 submissions in API
    mockListSubmissions.mockResolvedValueOnce([])

    renderComponent()

    expect(await screen.findByText('Speaking & IELTS Voice Lab')).toBeInTheDocument()

    // Header says Audio topshirmagan o‘quvchilar (16)
    const unsubmittedHeader = await screen.findByText('Audio topshirmagan o‘quvchilar')
    expect(unsubmittedHeader).toBeInTheDocument()
    expect(within(unsubmittedHeader.closest('.speaking-unsubmitted-header')!).getByText('(16)')).toBeInTheDocument()

    // Exactly 16 compact rows rendered
    const rows = document.querySelectorAll('.speaking-unsubmitted-row')
    expect(rows.length).toBe(16)

    // No giant cards or repetitive paragraph text
    expect(document.querySelectorAll('.speaking-submission-card').length).toBe(0)
    expect(screen.queryByText(/Audio topshirilmagan\. O‘quvchi sinfda/)).not.toBeInTheDocument()

    // Check first and last student inside unsubmitted table
    const unsubmittedTable = document.querySelector('.speaking-unsubmitted-table')!
    expect(unsubmittedTable).toBeInTheDocument()
    expect(within(unsubmittedTable as HTMLElement).getByText('Talaba_1 Familiya_1')).toBeInTheDocument()
    expect(within(unsubmittedTable as HTMLElement).getByText('#SPK101')).toBeInTheDocument()
    expect(within(unsubmittedTable as HTMLElement).getByText('Talaba_16 Familiya_16')).toBeInTheDocument()
    expect(within(unsubmittedTable as HTMLElement).getByText('#SPK116')).toBeInTheDocument()
  })

  it('safely normalizes student codes with existing leading hash and provides name tooltip', async () => {
    const { groupRepository } = await import('../features/groups/group.dependencies')
    vi.mocked(groupRepository.listStudents).mockResolvedValueOnce([
      {
        id: 'st-hashed',
        firstName: 'Muzaffar',
        lastName: 'Xolmatov',
        code: '#SPK777', // code already has leading hash
        status: 'active' as const,
        birthDate: '',
        phone: '',
        parentName: '',
        parentPhone: '',
        address: '',
        balance: 0,
        groups: ['g-1'],
      },
    ])
    mockListSubmissions.mockResolvedValueOnce([])

    renderComponent()

    expect(await screen.findByText('Speaking & IELTS Voice Lab')).toBeInTheDocument()

    // Both leaderboard and unsubmitted row should display single #SPK777, never ##SPK777
    const matches = await screen.findAllByText('#SPK777')
    expect(matches.length).toBe(2)
    expect(screen.queryByText('##SPK777')).not.toBeInTheDocument()

    // Student name in unsubmitted row has title tooltip attribute
    const unsubmittedTable = document.querySelector('.speaking-unsubmitted-table')!
    const nameEl = within(unsubmittedTable as HTMLElement).getByText('Muzaffar Xolmatov')
    expect(nameEl).toHaveAttribute('title', 'Muzaffar Xolmatov')
  })
})
