import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AttendancePage } from './pages/AttendancePage'
import { GroupsPage } from './pages/GroupsPage'

// Mock groupRepository
const mockGroups = [
  {
    id: 'g1',
    name: 'IELTS-24-01',
    course: 'IELTS Intensive',
    teacher: 'Alisher Karimov',
    room: '101-xona',
    weekdays: ['Du', 'Chor', 'Ju'],
    time: '09:00 - 10:30',
    startDate: '2026-07-01',
    endDate: '2026-12-31',
    activeStudents: 2,
    graduateStudents: 0,
    active: true,
  },
  {
    id: 'g2',
    name: 'CEFR-B2-01',
    course: 'CEFR B2',
    teacher: 'Malika Karimova',
    room: '102-xona',
    weekdays: ['Se', 'Pay', 'Sha'],
    time: '11:00 - 12:30',
    startDate: '2026-07-01',
    endDate: '2026-12-31',
    activeStudents: 0,
    graduateStudents: 0,
    active: true,
  },
]

const mockStudents = [
  {
    id: 's1',
    code: 'ST101',
    studentCode: 'ST101',
    firstName: 'Sardor',
    lastName: 'Abdullayev',
    birthDate: '2010-01-01',
    phone: '+998 90 444 55 66',
    parentName: 'Dilshod Abdullayev',
    parentPhone: '+998 90 444 55 66',
    address: 'Toshkent',
    status: 'active' as const,
    balance: 150000,
    groups: ['IELTS-24-01'],
  },
  {
    id: 's2',
    code: 'ST102',
    studentCode: 'ST102',
    firstName: 'Aziza',
    lastName: 'Rahimova',
    birthDate: '2008-05-12',
    phone: '+998 90 987 65 43',
    parentName: 'Shahnoza Rahimova',
    parentPhone: '+998 90 987 65 43',
    address: 'Toshkent',
    status: 'active' as const,
    balance: -400000,
    groups: ['IELTS-24-01'],
  },
]

const mockCandidateStudents = [
  ...mockStudents,
  {
    id: 's3',
    code: 'ST103',
    studentCode: 'ST103',
    firstName: 'Jasur',
    lastName: 'Toshmatov',
    birthDate: '2009-02-15',
    phone: '+998 90 111 22 33',
    parentName: 'Vali Toshmatov',
    parentPhone: '+998 90 111 22 33',
    address: 'Samarqand',
    status: 'active' as const,
    balance: 0,
    groups: [],
  },
]

const mockListStudents = vi.fn(async (groupId: string) => {
  if (groupId === 'g2') return []
  return [...mockStudents]
})
const mockAddStudent = vi.fn(async (_groupId: string, _studentId: string) => {})
const mockRemoveStudent = vi.fn(async (_groupId: string, _studentId: string) => {})

vi.mock('./features/groups/group.dependencies', () => ({
  groupRepository: {
    list: vi.fn(async () => mockGroups),
    save: vi.fn(async (g) => g),
    setActive: vi.fn(async () => {}),
    unlinkTelegram: vi.fn(async () => {}),
    listStudents: (id: string) => mockListStudents(id),
    addStudent: (gId: string, sId: string) => mockAddStudent(gId, sId),
    removeStudent: (gId: string, sId: string) => mockRemoveStudent(gId, sId),
  },
}))

vi.mock('./features/students/student.dependencies', () => ({
  studentRepository: {
    list: vi.fn(async () => mockCandidateStudents),
  },
}))

vi.mock('./features/attendance/attendance.dependencies', () => ({
  attendanceRepository: {
    get: vi.fn(async (groupId: string, date: string) => ({
      groupId,
      groupName: 'IELTS-24-01',
      date,
      homeworkText: 'Mavzu: Past Simple\nVazifa: 1-10 mashqlar',
      rows: [
        {
          studentId: 's1',
          studentCode: 'ST101',
          studentName: 'Sardor Abdullayev',
          status: 'came',
          rating: 90,
          homeworkScore: 90,
          topicScore: 90,
          dictionaryScore: 90,
          homeworkDone: true,
          comment: 'Yaxshi',
          lockedByAdmin: false,
        },
      ],
    })),
    getMonthly: vi.fn(async (groupId: string, month: string) => ({
      groupId,
      groupName: 'IELTS-24-01',
      month,
      daysInMonth: 31,
      lessonDates: [`${month}-01`, `${month}-03`],
      days: [
        {
          date: `${month}-01`,
          dayNumber: 1,
          weekday: 'Du',
          hasLesson: true,
          lessonTitle: 'Intro to IELTS',
        },
        {
          date: `${month}-02`,
          dayNumber: 2,
          weekday: 'Se',
          hasLesson: false,
          lessonTitle: null,
        },
        {
          date: `${month}-03`,
          dayNumber: 3,
          weekday: 'Chor',
          hasLesson: true,
          lessonTitle: 'Listening practice',
        },
      ],
      students: [
        {
          studentId: 's1',
          studentCode: 'ST101',
          studentName: 'Sardor Abdullayev',
          phone: '+998 90 444 55 66',
          days: {
            [`${month}-01`]: {
              status: 'came',
              rating: 90,
              homeworkDone: true,
              homeworkScore: 90,
              topicScore: 90,
              dictionaryScore: 90,
              comment: '',
            },
            [`${month}-03`]: {
              status: 'excused',
              rating: null,
              homeworkDone: false,
              comment: 'Betob',
            },
          },
          stats: {
            totalLessons: 2,
            came: 1,
            excused: 1,
            absent: 0,
            unmarked: 0,
            percentage: 50,
            averageScore: 90,
          },
        },
      ],
      stats: {
        totalStudents: 1,
        totalLessons: 2,
        averageAttendancePercentage: 50,
      },
    })),
    save: vi.fn(async (s) => s),
    broadcast: vi.fn(async () => ({ success: true, count: 1 })),
  },
}))

function renderWithClient(initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/groups" element={<GroupsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Senior Pro Client Requirements Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Requirement 1: Davomatda umumiy oylik tabel va tezkor davomat olish', () => {
    it('renders monthly sheet immediately with students, dates, status badges and Davomat olish button', async () => {
      renderWithClient('/attendance?group=g1&month=2026-07')

      expect(await screen.findByText('O‘rtacha davomat:')).toBeInTheDocument()
      expect(
        screen.getByText((_, el) => Boolean(el?.classList.contains('monthly-stat-pill') && el?.textContent?.includes('1 ta o‘quvchi'))),
      ).toBeInTheDocument()
      expect(
        screen.getByText((_, el) => Boolean(el?.classList.contains('monthly-stat-pill') && el?.textContent?.includes('2 ta dars'))),
      ).toBeInTheDocument()

      // Legend items must be present (+ Keldi, S Sababli, - Sababsiz, · Belgilanmagan)
      expect(screen.getAllByText('+').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Keldi').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Sababli').length).toBeGreaterThan(0)

      // Student row with status badge
      expect(screen.getAllByText(/Sardor Abdullayev/).length).toBeGreaterThan(0)
      expect(screen.getByTitle(/Sardor Abdullayev — 2026-07-01/)).toBeInTheDocument()

      // Davomat olish button must be directly visible in the monthly view
      const davomatOlishBtns = screen.getAllByRole('button', { name: /Davomat olish/ })
      expect(davomatOlishBtns.length).toBeGreaterThan(0)
    })

    it('clicking on a date column in the monthly sheet switches to daily register for that date', async () => {
      const user = userEvent.setup()
      renderWithClient('/attendance?group=g1&month=2026-07&view=monthly')

      expect(await screen.findByText(/Sardor Abdullayev/)).toBeInTheDocument()
      const dayCell = screen.getByTitle(/Sardor Abdullayev — 2026-07-01/)
      await user.click(dayCell)

      // Daily table should now be visible with lesson plan and save bar
      expect(await screen.findByLabelText('Dars mavzusi:')).toBeInTheDocument()
      expect(screen.getByLabelText('Uyga vazifa:')).toBeInTheDocument()
    })

    it('when changes are dirty and user switches to monthly tab, confirming prompt discards dirty changes and opens monthly tab', async () => {
      const user = userEvent.setup()
      renderWithClient('/attendance?group=g1&date=2026-07-01&view=daily')

      expect(await screen.findByText(/Sardor Abdullayev/)).toBeInTheDocument()

      // Change student status to Sababsiz to create dirty changes
      const absentBtn = screen.getByRole('button', { name: /Sardor Abdullayev: Sababsiz/i })
      await user.click(absentBtn)

      // Unsaved changes badge should show
      expect(screen.getByText(/saqlanmagan o‘zgarish/i)).toBeInTheDocument()

      // User clicks "Oylik tabel" tab
      const monthlyTab = screen.getByRole('tab', { name: /Oylik tabel/i })
      await user.click(monthlyTab)

      // Confirmation dialog must appear
      expect(screen.getByText('O‘zgarishlar saqlanmagan')).toBeInTheDocument()

      // User clicks "O‘zgarishsiz davom etish"
      const confirmBtn = screen.getByRole('button', { name: 'O‘zgarishsiz davom etish' })
      await user.click(confirmBtn)

      // Dialog should close and monthly tab should be active
      expect(screen.queryByText('O‘zgarishlar saqlanmagan')).not.toBeInTheDocument()
      expect(await screen.findByText('O‘rtacha davomat:')).toBeInTheDocument()
    })
  })

  describe('Requirement 2 & 3: Guruhlarni bosganda o‘quvchilar chiqishi, davomat olish va o‘quvchi qo‘shish/o‘chirish', () => {
    it('clicking on a group in Guruhlar opens the group roster modal with students and Davomat olish button', async () => {
      const user = userEvent.setup()
      renderWithClient('/groups')

      expect(await screen.findByText('IELTS-24-01')).toBeInTheDocument()

      // Click on the group row
      const groupRow = screen.getByRole('row', { name: /IELTS-24-01/ })
      await user.click(groupRow)

      // GroupDetailModal should open
      const modalHeader = await screen.findByRole('heading', { name: 'IELTS-24-01' })
      expect(modalHeader).toBeInTheDocument()

      // Should show group details
      expect(screen.getByText(/IELTS Intensive • Alisher Karimov/)).toBeInTheDocument()

      // Should display roster section with students
      expect(screen.getByRole('heading', { name: /Guruh o‘quvchilari/ })).toBeInTheDocument()
      expect(await screen.findByText('Sardor Abdullayev')).toBeInTheDocument()
      expect(screen.getByText('Aziza Rahimova')).toBeInTheDocument()

      // Davomat olish button must be present in group details
      const takeAttendanceBtn = screen.getByRole('button', { name: /Davomat olish/ })
      expect(takeAttendanceBtn).toBeInTheDocument()
    })

    it('clicking explicit O‘quvchilar button in group row opens group roster modal', async () => {
      const user = userEvent.setup()
      renderWithClient('/groups')

      expect(await screen.findByText('IELTS-24-01')).toBeInTheDocument()
      const rosterBtn = screen.getByRole('button', { name: 'IELTS-24-01 o‘quvchilar ro‘yxati' })
      await user.click(rosterBtn)

      expect(await screen.findByRole('heading', { name: 'IELTS-24-01' })).toBeInTheDocument()
      expect(await screen.findByText('Sardor Abdullayev')).toBeInTheDocument()
    })

    it('allows searching within the group roster', async () => {
      const user = userEvent.setup()
      renderWithClient('/groups')

      await user.click(await screen.findByText('IELTS-24-01'))
      expect(await screen.findByText('Sardor Abdullayev')).toBeInTheDocument()
      expect(screen.getByText('Aziza Rahimova')).toBeInTheDocument()

      const searchInput = screen.getByPlaceholderText('Qidirish...')
      await user.type(searchInput, 'Aziza')

      expect(screen.queryByText('Sardor Abdullayev')).not.toBeInTheDocument()
      expect(screen.getByText('Aziza Rahimova')).toBeInTheDocument()
    })

    it('allows adding a new student to the group via AddStudentToGroupModal', async () => {
      const user = userEvent.setup()
      renderWithClient('/groups')

      await user.click(await screen.findByText('IELTS-24-01'))
      expect(await screen.findByText('Sardor Abdullayev')).toBeInTheDocument()

      // Click "O‘quvchi qo‘shish"
      const addBtn = screen.getByRole('button', { name: /O‘quvchi qo‘shish/ })
      await user.click(addBtn)

      // Add student modal should open
      const modal = await screen.findByRole('dialog', { name: /Guruhga o‘quvchi qo‘shish/ })
      expect(modal).toBeInTheDocument()

      // Modern select trigger is rendered instead of plain native dropdown
      const trigger = within(modal).getByTestId('modern-select-trigger')
      expect(trigger).toBeInTheDocument()
      expect(trigger).toHaveTextContent('O‘quvchini tanlang')

      // Select student s3 (Jasur Toshmatov)
      const select = within(modal).getByRole('combobox')
      await user.selectOptions(select, 's3')
      expect(trigger).toHaveTextContent(/Jasur Toshmatov/)

      // Submit
      const submitBtn = screen.getByRole('button', { name: 'Guruhga qo‘shish' })
      await user.click(submitBtn)

      expect(mockAddStudent).toHaveBeenCalledWith('g1', 's3')
    })

    it('shows confirmation dialog when removing a student from group', async () => {
      const user = userEvent.setup()
      renderWithClient('/groups')

      await user.click(await screen.findByText('IELTS-24-01'))
      expect(await screen.findByText('Sardor Abdullayev')).toBeInTheDocument()

      // Click "Chiqarish" for Sardor
      const removeBtn = screen.getByRole('button', { name: 'Sardorni guruhdan chiqarish' })
      await user.click(removeBtn)

      // Confirm dialog should appear
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
      expect(screen.getByText(/Haqiqatan ham “Sardor Abdullayev” o‘quvchisini/)).toBeInTheDocument()

      // Confirm removal
      const confirmBtn = screen.getByRole('button', { name: 'Guruhdan chiqarish' })
      await user.click(confirmBtn)

      expect(mockRemoveStudent).toHaveBeenCalledWith('g1', 's1')
    })

    it('in empty group renders neat UI with exactly ONE O‘quvchi qo‘shish button, no redundant search and proper Yopish button in footer', async () => {
      const user = userEvent.setup()
      renderWithClient('/groups')

      await user.click(await screen.findByText('CEFR-B2-01'))
      expect(await screen.findByText('Guruhda hali o‘quvchilar yo‘q')).toBeInTheDocument()

      // Redundant search input should NOT be present when list is empty
      expect(screen.queryByPlaceholderText('Qidirish...')).not.toBeInTheDocument()

      // Exactly ONE "O‘quvchi qo‘shish" button on the screen (no duplicate "Birinchi o‘quvchini qo‘shish")
      const addBtns = screen.getAllByRole('button', { name: /O‘quvchi qo‘shish/ })
      expect(addBtns).toHaveLength(1)
      expect(screen.queryByRole('button', { name: /Birinchi o‘quvchini/ })).not.toBeInTheDocument()

      // Header has X and Footer has "Yopish" button
      const modal = screen.getByRole('dialog')
      const closeBtns = within(modal).getAllByRole('button', { name: 'Yopish' })
      expect(closeBtns).toHaveLength(2)
      await user.click(closeBtns[1])
      expect(screen.queryByText('CEFR B2 • Malika Karimova')).not.toBeInTheDocument()
    })
  })
})
