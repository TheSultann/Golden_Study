import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Exam, Group, Student } from '@golden-study/contracts'

import { ExamsPage } from './ExamsPage'

const mockGroups: Group[] = [
  {
    id: 'group-1',
    name: 'Grammar juft kuni',
    course: 'General English',
    teacher: 'Teacher One',
    room: '101',
    weekdays: ['Du', 'Chor', 'Ju'],
    time: '09:00 - 10:30',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    activeStudents: 20,
    graduateStudents: 0,
    active: true,
  },
  {
    id: 'group-2',
    name: 'IELTS Intensive',
    course: 'IELTS',
    teacher: 'Teacher Two',
    room: '102',
    weekdays: ['Se', 'Pay', 'Sha'],
    time: '11:00 - 12:30',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    activeStudents: 5,
    graduateStudents: 0,
    active: true,
  },
]

// 20 students in group-1 to simulate group with older students beyond top 100
const mockGroup1Students: Student[] = Array.from({ length: 20 }, (_, i) => ({
  id: `student-${i + 1}`,
  code: `ST-${1000 + i}`,
  firstName: `StudentFirst${i + 1}`,
  lastName: `StudentLast${i + 1}`,
  birthDate: '2005-01-01',
  phone: '+998901234567',
  parentName: 'Parent',
  parentPhone: '+998901234568',
  address: 'Tashkent',
  status: 'active',
  balance: 0,
  groups: ['Grammar juft kuni'],
}))

const mockGroup2Students: Student[] = [
  {
    id: 'student-g2-1',
    code: 'ST-2001',
    firstName: 'Aziza',
    lastName: 'Rahimova',
    birthDate: '2006-02-02',
    phone: '+998909876543',
    parentName: 'Parent',
    parentPhone: '+998909876544',
    address: 'Tashkent',
    status: 'active',
    balance: 0,
    groups: ['IELTS Intensive'],
  },
]

let savedExams: Exam[] = []
const mockListStudents = vi.fn(async (groupId: string) => {
  if (groupId === 'group-1') return mockGroup1Students
  if (groupId === 'group-2') return mockGroup2Students
  return []
})

const mockSaveExam = vi.fn(async (exam: Exam) => {
  savedExams.push(exam)
  return exam
})

vi.mock('../features/groups/group.dependencies', () => ({
  groupRepository: {
    list: vi.fn(async () => mockGroups),
    listStudents: (groupId: string) => mockListStudents(groupId),
    save: vi.fn(),
    setActive: vi.fn(),
    unlinkTelegram: vi.fn(),
    addStudent: vi.fn(),
    removeStudent: vi.fn(),
  },
}))

vi.mock('../features/exams/exam.dependencies', () => ({
  examRepository: {
    list: vi.fn(async () => savedExams),
    save: (exam: Exam) => mockSaveExam(exam),
    delete: vi.fn(async (id: string) => {
      savedExams = savedExams.filter((e) => e.id !== id)
    }),
  },
}))

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ExamsPage />
    </QueryClientProvider>,
  )
}

describe('ExamsPage - Group Students Exam Creation', () => {
  beforeEach(() => {
    savedExams = []
    mockListStudents.mockClear()
    mockSaveExam.mockClear()
  })

  it('fetches students specifically for the selected group and populates all 20 active students into exam results', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(await screen.findByRole('button', { name: /Imtihon qo‘shish/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Verify listStudents was called for group-1 (default active group)
    await waitFor(() => {
      expect(mockListStudents).toHaveBeenCalledWith('group-1')
    })

    // Header should display active student count
    expect(await screen.findByText(/Grammar juft kuni · 20 ta faol o‘quvchi/i)).toBeInTheDocument()

    // Fill form and save
    await user.type(screen.getByLabelText(/Nomi/i), 'Grammar Midterm')
    await user.click(screen.getByRole('button', { name: 'Saqlash' }))

    // Exam should be saved with all 20 students mapped into results
    await waitFor(() => {
      expect(mockSaveExam).toHaveBeenCalledTimes(1)
    })
    const savedExam = mockSaveExam.mock.calls[0][0] as Exam
    expect(savedExam.groupId).toBe('group-1')
    expect(savedExam.groupName).toBe('Grammar juft kuni')
    expect(savedExam.results).toHaveLength(20)
    expect(savedExam.results[0].studentName).toBe('StudentFirst1 StudentLast1')
    expect(savedExam.results[19].studentName).toBe('StudentFirst20 StudentLast20')
  })

  it('switches group, fetches new group students, and saves with updated group results', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(await screen.findByRole('button', { name: /Imtihon qo‘shish/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockListStudents).toHaveBeenCalledWith('group-1')
    })

    // Switch group to IELTS Intensive (group-2)
    await user.selectOptions(screen.getByLabelText('Guruh'), 'group-2')

    await waitFor(() => {
      expect(mockListStudents).toHaveBeenCalledWith('group-2')
    })

    expect(await screen.findByText(/IELTS Intensive · 1 ta faol o‘quvchi/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Nomi/i), 'IELTS Mock Exam')
    await user.click(screen.getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => {
      expect(mockSaveExam).toHaveBeenCalledTimes(1)
    })
    const savedExam = mockSaveExam.mock.calls[0][0] as Exam
    expect(savedExam.groupId).toBe('group-2')
    expect(savedExam.groupName).toBe('IELTS Intensive')
    expect(savedExam.results).toHaveLength(1)
    expect(savedExam.results[0].studentName).toBe('Aziza Rahimova')
  })

  it('shows loading indicator and disables submit button while fetching group students', async () => {
    let resolveStudents: (students: Student[]) => void
    mockListStudents.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStudents = resolve
        }),
    )

    const user = userEvent.setup()
    renderComponent()

    await user.click(await screen.findByRole('button', { name: /Imtihon qo‘shish/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Loading text should be present and submit button should be disabled
    expect(screen.getByText(/Guruh o‘quvchilari yuklanmoqda.../i)).toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: 'Saqlash' })
    expect(submitBtn).toBeDisabled()

    // Resolve query
    resolveStudents!(mockGroup1Students)

    await waitFor(() => {
      expect(screen.getByText(/Grammar juft kuni · 20 ta faol o‘quvchi/i)).toBeInTheDocument()
    })
    expect(submitBtn).not.toBeDisabled()
  })

  it('shows error message in header when fetching group students fails', async () => {
    mockListStudents.mockImplementationOnce(() => Promise.reject(new Error('Network error')))

    const user = userEvent.setup()
    renderComponent()

    await user.click(await screen.findByRole('button', { name: /Imtihon qo‘shish/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByText(/O‘quvchilar ro‘yxatini yuklab bo‘lmadi/i),
      ).toBeInTheDocument()
    })
  })

  it('excludes frozen and graduate students from exam results', async () => {
    const mixedStudents: Student[] = [
      {
        id: 's-active',
        code: 'ST-01',
        firstName: 'Active',
        lastName: 'Student',
        birthDate: '2005-01-01',
        phone: '+998901111111',
        parentName: 'Parent',
        parentPhone: '+998901111112',
        address: 'Tashkent',
        status: 'active',
        balance: 0,
        groups: ['Grammar juft kuni'],
      },
      {
        id: 's-frozen',
        code: 'ST-02',
        firstName: 'Frozen',
        lastName: 'Student',
        birthDate: '2005-01-01',
        phone: '+998901111113',
        parentName: 'Parent',
        parentPhone: '+998901111114',
        address: 'Tashkent',
        status: 'frozen',
        balance: 0,
        groups: ['Grammar juft kuni'],
      },
      {
        id: 's-graduate',
        code: 'ST-03',
        firstName: 'Graduate',
        lastName: 'Student',
        birthDate: '2005-01-01',
        phone: '+998901111115',
        parentName: 'Parent',
        parentPhone: '+998901111116',
        address: 'Tashkent',
        status: 'graduate',
        balance: 0,
        groups: ['Grammar juft kuni'],
      },
    ]

    mockListStudents.mockResolvedValueOnce(mixedStudents)

    const user = userEvent.setup()
    renderComponent()

    await user.click(await screen.findByRole('button', { name: /Imtihon qo‘shish/i }))
    expect(await screen.findByText(/Grammar juft kuni · 1 ta faol o‘quvchi/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Nomi/i), 'Grammar Test')
    await user.click(screen.getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => {
      expect(mockSaveExam).toHaveBeenCalledTimes(1)
    })
    const savedExam = mockSaveExam.mock.calls[0][0] as Exam
    expect(savedExam.results).toHaveLength(1)
    expect(savedExam.results[0].studentId).toBe('s-active')
    expect(savedExam.results[0].studentName).toBe('Active Student')
  })
})
