import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { createQueryClient } from './shared/query/queryClient'
import { clearSession } from './features/auth/auth.service'




// Mock dependencies and services to run App tests fully isolated on mocks
vi.mock('./features/auth/auth.service', () => {
  let session: any = null
  return {
    login: vi.fn(async (credentials: any) => {
      if (credentials.login === 'wrong' || credentials.password === 'wrong') {
        throw new Error('Login yoki parol noto‘g‘ri')
      }
      const role = credentials.login === 'teacher' ? 'teacher' : credentials.login === 'reception' ? 'admin' : 'superadmin'
      session = {
        id: role === 'teacher' ? 't1' : 'a1',
        login: credentials.login,
        name: role === 'teacher' ? "O‘qituvchi" : 'Administrator',
        role,
      }
      return session
    }),
    restoreSession: vi.fn(async () => session),
    logout: vi.fn(async () => { session = null }),
    getSession: vi.fn(() => session),
    clearSession: vi.fn(() => { session = null }),
  }
})

vi.mock('./features/dashboard/dashboard.dependencies', () => ({
  dashboardRepository: {
    get: vi.fn(async () => ({
      stats: [
        { label: "O‘quvchilar", value: '324', change: '+12%', tone: 'blue' },
        { label: 'Guruhlar', value: '18', change: '+2', tone: 'green' },
        { label: "O‘qituvchilar", value: '12', change: '0', tone: 'gold' },
        { label: 'Oylik tushum', value: '45,200,000 UZS', change: '+8%', tone: 'violet' }
      ],
      upcomingLessons: [
        { time: '09:00', title: 'IELTS Intensive', meta: 'Alisher Karimov · 12 o‘quvchi', room: '101-room' }
      ],
      recentPayments: [
        { date: '05.07.2026', student: 'Sardor Abdullayev', course: 'IELTS Intensive', amount: '900,000 UZS', status: 'To‘langan', tone: 'success' }
      ]
    }))
  }
}))

vi.mock('./features/teacher-salary/teacherSalary.dependencies', () => ({
  teacherSalaryRepository: {
    getOverview: vi.fn(async () => ({
      teacherName: 'Alisher Karimov',
      pendingBalanceUzs: 1200000,
      totalPaidUzs: 3500000,
      salaryType: 'percent',
      salaryRate: 80,
      lastPaidAt: '2026-08-01T10:00:00.000Z',
      history: [
        {
          id: 'p1',
          date: '2026-08-01T10:00:00.000Z',
          amountUzs: 1500000,
          type: 'payout',
          status: 'paid',
          title: 'To‘langan maosh',
          comment: 'Avans to‘lovi',
        },
        {
          id: 'pending-1',
          date: '2026-08-15T10:00:00.000Z',
          amountUzs: 1200000,
          type: 'accrual',
          status: 'pending',
          title: 'Kutilayotgan maosh',
          comment: 'To‘lov kutilmoqda',
        },
      ],
    })),
  },
}))

vi.mock('./features/student-profile/studentProfile.dependencies', () => ({
  studentProfileRepository: {
    getById: vi.fn(async (id: string) => ({
      identity: {
        id: id || 's1',
        studentCode: 'ST101',
        firstName: 'Jasur',
        lastName: 'Aliyev',
        fullName: 'Jasur Aliyev',
        status: 'active',
        parentName: 'Ali Aliyev',
        parentPhone: '+998 90 123 45 67',
        birthDate: '2010-01-01',
        createdAt: '2026-01-01'
      },
      academic: {
        activeGroupsCount: 1,
        attendancePercent: 95,
        averageExamScore: 90,
        homeworkCompletionPercent: 90,
        groups: [{ id: 'g1', name: 'Frontend-01', courseName: 'Frontend', teacherName: 'Alisher Karimov' }]
      },
      finance: {
        balance: 150000,
        totalPaid: 1500000,
        totalDebt: 0,
        payments: []
      },
      contacts: {
        phone: '+998 90 123 45 67',
        parentPhone: '+998 90 123 45 67',
        telegramChatId: '12345678'
      }
    }))
  }
}))

vi.mock('./features/courses/course.dependencies', () => {
  const delay = () => Promise.resolve()
  let courses = [
    { id: 'c1', title: 'IELTS Preparation', description: 'IELTS course', durationMonths: 6, pricePerMonth: 900000, pricePerMonthUzs: 900000, groupsCount: 2, studentsCount: 20, isActive: true, active: true },
    { id: 'c2', title: 'Ingliz tili', description: 'English course', durationMonths: 6, pricePerMonth: 600000, pricePerMonthUzs: 600000, groupsCount: 1, studentsCount: 10, isActive: true, active: true },
    { id: 'c3', title: 'Matematika', description: 'Math course', durationMonths: 9, pricePerMonth: 500000, pricePerMonthUzs: 500000, groupsCount: 1, studentsCount: 8, isActive: true, active: true },
  ]
  return {
    courseRepository: {
      list: vi.fn(async () => { await delay(); return courses }),
      create: vi.fn(async (c: any) => { await delay(); const item = { groupsCount: 0, studentsCount: 0, active: true, ...c }; courses.push(item); return item }),
      update: vi.fn(async (c: any) => { await delay(); courses = courses.map(x => x.id === c.id ? { ...x, ...c } : x); return c }),
      setActive: vi.fn(async (id: string, active: boolean) => { await delay(); courses = courses.map(x => x.id === id ? { ...x, active } : x) }),
    }
  }
})

vi.mock('./features/teachers/teacher.dependencies', () => {
  const delay = () => Promise.resolve()
  let teachers = [
    { id: 't1', firstName: 'Alisher', lastName: 'Karimov', phone: '+998 90 123 45 67', salaryType: 'percent', rate: 8000, kpiRateBasisPoints: 8000, active: true, salaryBalance: 0, login: 'teacher', password: 'teacher-local-2026', groups: ['g1'], kpiBalance: 0 },
  ]
  return {
    teacherRepository: {
      list: vi.fn(async () => { await delay(); return teachers }),
      save: vi.fn(async (t: any) => {
        await delay()
        const fullTeacher = { groups: [], kpiBalance: 0, active: true, rate: t.rate ?? 8000, ...t }
        const exists = teachers.some(x => x.id === t.id)
        teachers = exists ? teachers.map(x => x.id === t.id ? { ...x, ...fullTeacher } : x) : [fullTeacher, ...teachers]
        return fullTeacher
      }),
      setActive: vi.fn(async (id: string, active: boolean) => { await delay(); teachers = teachers.map(x => x.id === id ? { ...x, active } : x) }),
    }
  }
})

vi.mock('./features/groups/group.dependencies', () => {
  const delay = () => Promise.resolve()
  let groups = [
    { id: 'g1', name: 'IELTS-24-01', course: 'IELTS Intensive', teacher: 'Alisher Karimov', room: '101-xona', weekdays: ['Du', 'Chor', 'Ju'], time: '09:00 - 10:30', startDate: '2026-07-01', endDate: '2026-12-31', activeStudents: 12, graduateStudents: 0, active: true },
    { id: 'g2', name: 'ENG-24-03', course: 'General English', teacher: 'Nargiza Sobirova', room: '102-xona', weekdays: ['Se', 'Pay', 'Sha'], time: '11:00 - 12:30', startDate: '2026-07-01', endDate: '2026-12-31', activeStudents: 10, graduateStudents: 0, active: true },
    { id: 'g3', name: 'Kids English A1', course: 'Kids English', teacher: 'Nargiza Sobirova', room: '103-xona', weekdays: ['Du', 'Chor', 'Ju'], time: '14:00 - 15:30', startDate: '2026-07-01', endDate: '2026-12-31', activeStudents: 8, graduateStudents: 0, active: true },
  ]
  return {
    groupRepository: {
      list: vi.fn(async () => { await delay(); return groups }),
      create: vi.fn(async (g: any) => { await delay(); groups.push(g); return g }),
      update: vi.fn(async (g: any) => { await delay(); groups = groups.map(x => x.id === g.id ? g : x); return g }),
    }
  }
})

vi.mock('./features/students/student.dependencies', () => {
  const delay = () => Promise.resolve()
  let students = [
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
      status: 'active',
      balance: 150000,
      groups: ['g1', 'IELTS-24-01']
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
      status: 'active',
      balance: -400000,
      groups: ['g1', 'IELTS-24-01']
    },
    {
      id: 's3',
      code: 'ST105',
      studentCode: 'ST105',
      firstName: 'Sevinch',
      lastName: 'Karimova',
      birthDate: '2009-03-20',
      phone: '+998 90 555 44 33',
      parentName: 'Karimov',
      parentPhone: '+998 90 555 44 33',
      address: 'Toshkent',
      status: 'active',
      balance: 0,
      groups: ['g3', 'Kids English A1']
    },
    {
      id: 's4',
      code: 'ST103',
      studentCode: 'ST103',
      firstName: 'Jasur',
      lastName: 'Sobirov',
      birthDate: '2009-04-15',
      phone: '+998 90 666 77 88',
      parentName: 'Sobirov',
      parentPhone: '+998 90 666 77 88',
      address: 'Toshkent',
      status: 'active',
      balance: 0,
      groups: ['g3', 'Kids English A1']
    }
  ]
  return {
    studentRepository: {
      list: vi.fn(async () => { await delay(); return [...students] }),
      save: vi.fn(async (s: any) => {
        await delay()
        const item = { id: `s-${Date.now()}`, code: `ST${Date.now()}`, studentCode: `ST${Date.now()}`, birthDate: '2010-01-01', phone: '+998 90 123 45 67', parentName: 'Parent', parentPhone: '+998 90 123 45 67', address: 'Toshkent', status: 'active', balance: 0, groups: [], ...s }
        students.push(item)
        return item
      }),
    }
  }
})

vi.mock('./features/attendance/attendance.dependencies', () => {
  const delay = () => Promise.resolve()
  return {
    attendanceRepository: {
      get: vi.fn(async (groupId: string, date: string) => {
        return {
          groupId: groupId || 'g1',
          groupName: 'IELTS-24-01',
          date,
          rows: [
            { studentId: 's1', studentCode: 'ST101', studentName: 'Sardor Abdullayev', status: 'came', comment: 'A’lo', rating: 95, homeworkDone: true, lockedByAdmin: false },
            { studentId: 's2', studentCode: 'ST102', studentName: 'Aziza Rahimova', status: 'came', comment: 'Yaxshi', rating: 85, homeworkDone: true, lockedByAdmin: false }
          ]
        }
      }),
      save: vi.fn(async (s: any) => { await delay(); return s }),
    }
  }
})

vi.mock('./features/leads/lead.dependencies', () => {
  let leads: any[] = [
    { id: 'l1', fullName: 'Azizbek Rahmonov', phone: '+998 90 111 22 33', course: 'IELTS Intensive', teacher: 'Alisher Karimov', status: 'new', comment: 'Qiziqmoqda', createdAt: '2026-07-01T10:00:00Z' }
  ]
  const delay = () => Promise.resolve()
  return {
    leadRepository: {
      list: vi.fn(async () => { await delay(); return leads }),
      save: vi.fn(async (l: any) => { await delay(); leads.push(l); return l }),
    }
  }
})

vi.mock('./features/finance/finance.dependencies', () => {
  const delay = () => Promise.resolve()
  let overviewData = {
    summary: { income: 5000000, expense: 1500000, profit: 3500000, debt: 800000, salaryDebt: 1200000 },
    payments: [
      { id: 'p1', studentCode: 'ST101', studentName: 'Sardor Abdullayev', group: 'IELTS-24-01', amount: 500000, method: 'Naqd', paidAt: '2026-07-05T10:00:00Z' }
    ],
    debts: [
      { id: 'd1', studentCode: 'ST102', studentName: 'Aziza Rahimova', group: 'IELTS-24-01', parentPhone: '+998901234567', balance: 400000 }
    ],
    salaries: [
      { id: 'ts1', teacherName: 'Alisher Karimov', salaryType: 'percent' as const, rate: 8000, kpiBalance: 1500000, groups: ['IELTS-24-01'] },
      { id: 'ts2', teacherName: 'Nargiza Sobirova', salaryType: 'per_student' as const, rate: 50000, kpiBalance: 800000, groups: ['ENG-24-03'] }
    ],
    transactions: [
      { id: 'tr1', type: 'income' as const, category: 'O‘qish to‘lovi', amount: 500000, subject: 'Sardor Abdullayev', comment: 'July payment', createdAt: '2026-07-05T10:00:00Z' },
      { id: 'tr2', type: 'expense' as const, category: 'Ijara', amount: 2000000, subject: 'Bino ijarasi', comment: 'Office rent', createdAt: '2026-07-01T10:00:00Z' }
    ]
  }
  return {
    financeRepository: {
      overview: vi.fn(async () => { return JSON.parse(JSON.stringify(overviewData)) }),
      saveStudentPayment: vi.fn(async (p: any) => { await delay(); return p }),
      saveExpense: vi.fn(async (e: any) => { await delay(); return e }),
      saveTransaction: vi.fn(async (t: any) => { await delay(); return t }),
      paySalary: vi.fn(async (id: string) => {
        await delay()
        overviewData.salaries = overviewData.salaries.map((s) => s.id === id ? { ...s, kpiBalance: 0, isPaidThisMonth: true } : s)
        return { id }
      }),
    }
  }
})

vi.mock('./features/announcements/announcement.dependencies', () => {
  const delay = () => Promise.resolve()
  let list: any[] = [
    { id: 'a0', targetType: 'all', targetId: null, targetName: 'Barcha ota-onalar', title: 'Iyul oyi to‘lovlari', body: 'Iyul oyi to‘lovlarini o‘z vaqtida amalga oshiring.', deliveryStatus: 'BOT_DELIVERED', createdAt: '2026-07-06T10:00:00Z', scheduledAt: null, deliveredAt: '2026-07-06T10:01:00Z' }
  ]
  return {
    announcementRepository: {
      list: vi.fn(async () => { await delay(); return list }),
      send: vi.fn(async (item: any) => {
        await delay()
        const fullItem = {
          id: `a-${Date.now()}`,
          title: item.title,
          body: item.body,
          targetType: item.targetType || 'all',
          targetId: item.targetId || null,
          targetName: item.targetName || 'Barcha ota-onalar',
          deliveryStatus: item.scheduledAt ? 'scheduled' : 'BOT_DELIVERED',
          createdAt: new Date().toISOString(),
          scheduledAt: item.scheduledAt || null,
          deliveredAt: item.scheduledAt ? null : new Date().toISOString(),
          ...item
        }
        list = [fullItem, ...list]
        return fullItem
      }),
    }
  }
})

vi.mock('./features/exams/exam.dependencies', () => {
  const delay = () => Promise.resolve()
  let list: any[] = [
    {
      id: 'ex1',
      groupId: 'g1',
      groupName: 'IELTS-24-01',
      name: 'Mock IELTS Listening',
      title: 'Mock IELTS Listening',
      date: '2026-07-01',
      maxScore: 100,
      averageScore: 90,
      results: [
        { studentId: 's1', studentCode: 'ST101', studentName: 'Sardor Abdullayev', score: 100, comment: 'Great', rank: 1 },
        { studentId: 's2', studentCode: 'ST102', studentName: 'Aziza Rahimova', score: 85, comment: 'Good', rank: 2 },
      ]
    },
    {
      id: 'ex2',
      groupId: 'g3',
      groupName: 'Kids English A1',
      name: 'Kids Vocabulary Exam',
      title: 'Kids Vocabulary Exam',
      date: '2026-07-05',
      maxScore: 100,
      averageScore: 92,
      results: [
        { studentId: 's3', studentCode: 'ST105', studentName: 'Sevinch Karimova', score: 95, comment: 'Super', rank: 1 },
        { studentId: 's4', studentCode: 'ST103', studentName: 'Jasur Sobirov', score: 90, comment: 'Well done', rank: 2 },
      ]
    }
  ]
  return {
    examRepository: {
      list: vi.fn(async () => { await delay(); return list }),
      save: vi.fn(async (item: any) => {
        await delay()
        const idx = list.findIndex((x) => x.id === item.id)
        if (idx >= 0) {
          list[idx] = item
        } else {
          list.push(item)
        }
        return item
      }),
    }
  }
})

vi.mock('./features/staff/staff.dependencies', () => {
  const delay = () => Promise.resolve()
  let list: any[] = [
    { id: 'st1', fullName: 'Dilshod Valiev', login: 'dilshod', phone: '+998 90 123 45 67', role: 'admin', status: 'active', linkedTeacherId: null, lastLoginAt: '2026-07-06T10:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'st2', fullName: 'Nargiza Sobirova', login: 'nargiza', phone: '+998 90 987 65 43', role: 'admin', status: 'active', linkedTeacherId: null, lastLoginAt: '2026-07-05T10:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
  ]
  return {
    staffRepository: {
      list: vi.fn(async () => { await delay(); return list }),
      create: vi.fn(async (input: any) => {
        await delay()
        const newMember = { id: `st-${Date.now()}`, status: 'active', linkedTeacherId: null, lastLoginAt: null, createdAt: new Date().toISOString(), ...input }
        list.push(newMember)
        return newMember
      }),
      update: vi.fn(async (item: any) => {
        await delay()
        list = list.map(x => x.id === item.id ? { ...x, ...item } : x)
        return item
      }),
      setStatus: vi.fn(async (id: string, status: any) => {
        await delay()
        list = list.map(x => x.id === id ? { ...x, status } : x)
        return list.find(x => x.id === id)
      }),
    }
  }
})

vi.mock('./features/settings/settings.dependencies', () => {
  const delay = () => Promise.resolve()
  let currentSettings = { id: 'cs1', centerName: 'Golden Study CRM', logoUrl: null, timezone: 'Asia/Tashkent' as const, currency: 'UZS' as const, dateFormat: 'DD.MM.YYYY' as const, updatedAt: new Date().toISOString() }
  return {
    settingsRepository: {
      get: vi.fn(async () => { await delay(); return currentSettings }),
      save: vi.fn(async (info: any) => {
        await delay()
        currentSettings = { ...currentSettings, ...info }
        return currentSettings
      }),
    }
  }
})

vi.mock('./features/teacher-dashboard/teacherDashboard.dependencies', () => ({
  teacherDashboardRepository: {
    get: vi.fn(async () => ({
      teacherName: 'Alisher Karimov',
      activeGroups: 2,
      activeStudents: 15,
      todayLessons: 1,
      attendancePercent: 85,
      upcomingLessons: [
        { id: 'l1', groupId: 'g1', groupName: 'IELTS-24-01', courseName: 'IELTS', time: '09:00 - 10:30', room: 'Room 1' },
        { id: 'l2', groupId: 'g2', groupName: 'ENG-24-03', courseName: 'English', time: '11:00 - 12:30', room: 'Room 2' },
      ],
      kpiBalance: 1500000,
      salaryType: 'percent',
      salaryRate: 80,
      lastSalaryPaidAt: null,
    }))
  }
}))

vi.mock('./features/teacher-schedule/teacherSchedule.dependencies', () => ({
  teacherScheduleRepository: {
    list: vi.fn(async () => [
      { id: 's1', groupId: 'g1', groupName: 'IELTS-24-01', courseName: 'IELTS', weekday: 'Du', time: '09:00 - 10:30', room: 'Room 1', studentsCount: 10 },
      { id: 's2', groupId: 'g2', groupName: 'ENG-24-03', courseName: 'English', weekday: 'Se', time: '11:00 - 12:30', room: 'Room 2', studentsCount: 15 },
    ])
  }
}))

vi.mock('./features/teacher-attendance/teacherAttendance.dependencies', () => ({
  teacherAttendanceRepository: {
    listGroups: vi.fn(async () => [
      { id: 'g1', name: 'IELTS-24-01' },
      { id: 'g2', name: 'ENG-24-03' }
    ]),
    get: vi.fn(async (groupId: string, date: string) => ({
      groupId: groupId || 'g1',
      groupName: groupId === 'g2' ? 'ENG-24-03' : 'IELTS-24-01',
      date,
      rows: [
        { studentId: 's1', studentCode: 'ST101', studentName: 'Sardor Abdullayev', status: 'absent', rating: 95, homeworkDone: true, comment: 'Lokal', lockedByAdmin: true },
        { studentId: 's2', studentCode: 'ST102', studentName: 'Aziza Rahimova', status: 'absent', rating: 85, homeworkDone: false, comment: '', lockedByAdmin: false }
      ]
    })),
    save: vi.fn(async (s: any) => s)
  }
}))

vi.mock('./features/teacher-exams/teacherExams.dependencies', () => {
  let exams: any[] = [
    {
      id: 'e1',
      groupId: 'g2',
      groupName: 'ENG-24-03',
      name: 'Mock IELTS Listening',
      title: 'Mock IELTS Listening',
      date: '2026-07-07',
      maxScore: 100,
      averageScore: 78,
      results: [
        { studentId: 's1', studentCode: 'ST101', studentName: 'Sardor Abdullayev', score: 30, comment: '', rank: 1 },
        { studentId: 's2', studentCode: 'ST102', studentName: 'Aziza Rahimova', score: 25, comment: '', rank: 2 },
      ],
    }
  ]
  return {
    teacherExamsRepository: {
      list: vi.fn(async () => exams),
      listGroups: vi.fn(async () => [{ id: 'g2', name: 'ENG-24-03', students: [{ id: 's1', code: 'ST101', name: 'Sardor Abdullayev' }] }]),
      save: vi.fn(async (s: any) => {
        const index = exams.findIndex((item) => item.id === s.id)
        if (index >= 0) {
          exams[index] = s
        } else {
          exams.push(s)
        }
        return s
      }),
    }
  }
})

vi.mock('./features/teacher-rating/teacherRating.dependencies', () => ({
  teacherRatingRepository: {
    list: vi.fn(async () => [
      { id: 'r1', rank: 1, studentId: 's1', studentCode: 'ST101', studentName: 'Sardor Abdullayev', groupName: 'IELTS-24-01', totalScore: 95, stars: 5, averagePercent: 95, examsCount: 2, attendanceRating: 95, homeworkRate: 100 },
      { id: 'r2', rank: 2, studentId: 's2', studentCode: 'ST102', studentName: 'Aziza Rahimova', groupName: 'IELTS-24-01', totalScore: 88, stars: 4, averagePercent: 88, examsCount: 2, attendanceRating: 85, homeworkRate: 80 },
      { id: 'r3', rank: 3, studentId: 's3', studentCode: 'ST103', studentName: 'Dilnoza Ergasheva', groupName: 'ENG-24-03', totalScore: 92, stars: 5, averagePercent: 92, examsCount: 2, attendanceRating: 90, homeworkRate: 90 },
    ])
  }
}))

vi.mock('./features/telegram/telegram.dependencies', () => {
  const delay = () => Promise.resolve()
  const links: any[] = [
    { id: 'tl1', telegramChatId: '12345678', studentId: 's1', studentCode: 'ST101', studentName: 'Sardor Abdullayev', parentName: 'Dilshod Abdullayev', parentPhone: '+998901234567', status: 'pending', requestedAt: '2026-07-07T10:00:00Z' },
    { id: 'tl2', telegramChatId: '782905555', studentId: 's2', studentCode: 'ST105', studentName: 'Aziza Rahimova', parentName: 'Shahnoza Rahimova', parentPhone: '+998909876543', status: 'active', requestedAt: '2026-07-06T10:00:00Z' },
  ]
  const notifications: any[] = [
    { id: 'tn1', telegramLinkId: 'tl2', triggerType: 'attendance_absent', status: 'sent', payload: 'ST105 davomat holati yuborildi', queuedAt: '2026-07-07T09:00:00Z', sentAt: '2026-07-07T09:01:00Z', attempts: 1, maxAttempts: 3, errorMessage: null, jobId: 'tg-job-nl-1' }
  ]
  return {
    telegramBotRepository: {
      getOverview: vi.fn(async () => {
        await delay()
        return {
          links,
          notifications,
          queue: { waiting: 1, active: 0, failed: 0, sentToday: 5 },
          service: { mode: 'polling', status: 'online', lastHeartbeatAt: '2026-07-07T10:00:00Z' }
        }
      }),
      setLinkStatus: vi.fn(async (id: string, status: any) => {
        await delay()
        const link = links.find(l => l.id === id)
        if (link) link.status = status
        return link
      }),
      enqueueNotification: vi.fn(async (linkId: string, triggerType: any) => {
        await delay()
        const item = { id: `tn-${Date.now()}`, telegramLinkId: linkId, triggerType, status: 'queued', payload: 'Test xabari', queuedAt: new Date().toISOString(), sentAt: null, attempts: 1, maxAttempts: 3, errorMessage: null, jobId: 'job-test' }
        notifications.unshift(item)
        return item
      })
    }
  }
})





function renderApp() {
  return render(
    <BrowserRouter>
      <QueryClientProvider client={createQueryClient()}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>,
  )
}

describe('mock-авторизация', () => {

  beforeEach(() => {
    window.localStorage.clear()
    window.history.pushState({}, '', '/login')
    clearSession()
  })


  it('показывает форму входа без кнопок быстрого выбора роли', () => {
    renderApp()

    expect(screen.getByRole('heading', { name: 'Tizimga kirish' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Administrator' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "O‘qituvchi" })).not.toBeInTheDocument()
  })

  it('выполняет вход администратора', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.clear(screen.getByLabelText('Login'))
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.clear(screen.getByLabelText('Parol'))
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByRole('heading', { name: 'Bosh sahifa' })).toBeInTheDocument()
    expect(screen.getByText('Dashboard yuklanmoqda...')).toBeInTheDocument()
    expect(await screen.findByText('324')).toBeInTheDocument()
  })

  it('показывает администратору полное меню CRM', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.clear(screen.getByLabelText('Login'))
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.clear(screen.getByLabelText('Parol'))
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByRole('navigation', { name: 'Asosiy navigatsiya' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Moliya' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sozlamalar' })).toBeInTheDocument()
    expect(screen.queryByText('Toshkent, Chilonzor tumani')).not.toBeInTheDocument()
    expect(screen.queryByText('+998 90 123 45 67')).not.toBeInTheDocument()
  })

  it('открывает реестр преподавателей', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'O‘qituvchilar' }))

    expect(await screen.findByRole('heading', { name: 'O‘qituvchilar' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'O‘qituvchilar ro‘yxati' })).toBeInTheDocument()
    expect(await screen.findByText('Alisher Karimov')).toBeInTheDocument()
  })

  it('открывает каталог курсов', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Kurslar' }))

    expect(await screen.findByRole('heading', { name: 'Kurslar' })).toBeInTheDocument()
    expect(await screen.findByText('IELTS Preparation')).toBeInTheDocument()
  })

  it('открывает курс кликом и с клавиатуры', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Kurslar' }))

    const card = await screen.findByRole('button', { name: 'IELTS Preparation kursini tahrirlash' })
    card.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: 'Kursni tahrirlash' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yopish' }))
    await user.click(card)
    expect(screen.getByRole('heading', { name: 'Kursni tahrirlash' })).toBeInTheDocument()
  })

  it('подтверждает отключение курса отдельно от редактирования', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Kurslar' }))
    await screen.findByText('IELTS Preparation')

    await user.click(screen.getByRole('button', { name: 'IELTS Preparation kursini o‘chirish' }))
    expect(screen.queryByRole('heading', { name: 'Kursni tahrirlash' })).not.toBeInTheDocument()
    expect(screen.getByRole('alertdialog', { name: 'Kursni o‘chirish' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bekor qilish' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'IELTS Preparation kursini o‘chirish' })).toBeInTheDocument()
  })


  it('открывает список групп', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Guruhlar' }))

    expect(await screen.findByRole('heading', { name: 'Guruhlar' })).toBeInTheDocument()
    expect(await screen.findByText('IELTS-24-01')).toBeInTheDocument()
  })

  it('открывает группу строкой и форматирует даты', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Guruhlar' }))

    const row = await screen.findByRole('row', { name: 'IELTS-24-01 guruhini tahrirlash' })
    expect(within(row).getByText('01.07.2026')).toBeInTheDocument()
    expect(within(row).getByText('31.12.2026')).toBeInTheDocument()
    row.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: 'Guruhni tahrirlash' })).toBeInTheDocument()
  })

  it('подтверждает завершение группы отдельно от редактирования', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Guruhlar' }))
    await screen.findByText('IELTS-24-01')

    await user.click(screen.getByRole('button', { name: 'IELTS-24-01 guruhini yakunlash' }))
    expect(screen.queryByRole('heading', { name: 'Guruhni tahrirlash' })).not.toBeInTheDocument()
    expect(screen.getByRole('alertdialog', { name: 'Guruhni yakunlash' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bekor qilish' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('открывает реестр учеников', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'O‘quvchilar' }))
    expect(await screen.findByRole('heading', { name: 'O‘quvchilar' })).toBeInTheDocument()
    expect(await screen.findByText('ST101')).toBeInTheDocument()
  })

  it('filters students, clears search and shows an empty state', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'O‘quvchilar' }))
    await screen.findByText('ST101')

    await user.type(screen.getByRole('searchbox', { name: 'O‘quvchi qidirish' }), 'topilmadi')
    expect(screen.getByText('O‘quvchi topilmadi')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Qidiruvni tozalash' }))
    expect(await screen.findByText('ST101')).toBeInTheDocument()
  })

  it('confirms freezing from the student actions menu', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'O‘quvchilar' }))
    await screen.findByText('ST101')

    await user.click(screen.getByRole('button', { name: 'ST101 amallari' }))
    await user.click(screen.getByRole('menuitem', { name: 'Muzlatish' }))
    expect(screen.getByRole('alertdialog', { name: 'O‘quvchini muzlatish' })).toBeInTheDocument()
  })

  it('uses dedicated mobile-safe student action controls', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'O‘quvchilar' }))
    await screen.findByText('ST101')

    const studentName = screen.getByText('Sardor Abdullayev')
    const studentCode = screen.getByText('ST101')
    const parentPhone = screen.getAllByText('+998 90 444 55 66').find(el => el.parentElement?.classList.contains('student-cell-value')) || screen.getAllByText('+998 90 444 55 66')[0]
    expect(studentName).toHaveClass('student-card-name')
    expect(studentCode).toHaveClass('student-card-code')
    expect(parentPhone.parentElement).toHaveClass('student-cell-value')
    expect(studentName.compareDocumentPosition(studentCode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const exportButton = screen.getByRole('button', { name: 'O‘quvchilar ro‘yxatini eksport qilish' })
    expect(exportButton).toHaveClass('student-header-button')
    expect(exportButton.querySelector('.student-header-button-label')).toHaveTextContent('Eksport')
    expect(screen.getByRole('button', { name: 'O‘quvchi qo‘shish' })).toHaveClass('student-add-button')
    const actionsButton = screen.getByRole('button', { name: 'ST101 amallari' })
    expect(actionsButton.parentElement?.tagName).toBe('TD')
    await user.click(actionsButton)
    const menu = screen.getByRole('menu', { name: 'ST101 amallari' })
    expect(menu).toHaveClass('student-actions-menu')
    expect(menu).toHaveStyle({ position: 'fixed' })
  })

  it('uses one full-name field in teacher and student forms', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    await user.click(await screen.findByRole('link', { name: 'O‘qituvchilar' }))
    await user.click(await screen.findByRole('link', { name: 'O‘qituvchi qo‘shish' }))
    let dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Ism familiya')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Ism')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Familiya')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Tizimga kirish')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Login va parolni nusxalash' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Yopish' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.search).toBe('')

    await user.click(await screen.findByRole('link', { name: 'O‘quvchilar' }))
    await user.click(await screen.getByRole('button', { name: 'O‘quvchi qo‘shish' }))
    dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Ism familiya')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Ism')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Familiya')).not.toBeInTheDocument()
  }, 15_000)

  it('открывает журнал посещаемости', async () => {
    const user = userEvent.setup(); renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin'); await user.type(screen.getByLabelText('Parol'), 'admin123'); await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Davomat' }))
    expect(await screen.findByRole('heading', { name: 'Davomat' })).toBeInTheDocument()
    expect(await screen.findByText('Sardor Abdullayev')).toBeInTheDocument()
  })

  it('renders compact attendance workflow', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Davomat' }))

    const row = await screen.findByRole('row', { name: /Sardor Abdullayev/ })
    expect(row.querySelector('.attendance-card-head')).toBeInTheDocument()
    expect(row.querySelector('.attendance-card-status')).toBeInTheDocument()
    expect(row.querySelector('.attendance-card-meta')).toBeInTheDocument()
    expect(screen.getByLabelText('Dars mavzusi:')).toBeInTheDocument()
    expect(screen.getByLabelText('Uyga vazifa:')).toBeInTheDocument()

    const ratingInput = screen.getByLabelText('Sardor Abdullayev vazifa bahosi')
    expect(ratingInput).toBeInTheDocument()
    expect(ratingInput).toHaveValue(95)
    await user.clear(ratingInput)
    expect(ratingInput).toHaveValue(null)
    await user.type(ratingInput, '88')
    expect(ratingInput).toHaveValue(88)
    expect(screen.getByRole('button', { name: 'Saqlash' }).closest('.attendance-savebar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sardor Abdullayev: Sababli' }))
    expect(screen.getByRole('button', { name: 'Saqlash' }).closest('.attendance-savebar')).toBeInTheDocument()
  })

  it('warns before changing attendance filters with unsaved changes', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Davomat' }))
    await screen.findByText('Sardor Abdullayev')

    await user.click(screen.getByRole('button', { name: 'Sardor Abdullayev: Sababsiz' }))
    expect(screen.getByText('1 ta saqlanmagan o‘zgarish')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Guruh' }), 'g2')
    expect(screen.getByRole('alertdialog', { name: 'O‘zgarishlar saqlanmagan' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bekor qilish' }))
    expect(screen.getByRole('combobox', { name: 'Guruh' })).toHaveValue('g1')
  })

  it('открывает воронку лидов', async () => {
    const user=userEvent.setup();renderApp();await user.type(screen.getByLabelText('Login'),'admin');await user.type(screen.getByLabelText('Parol'),'admin123');await user.click(screen.getByRole('button',{name:'Kirish'}));await user.click(await screen.findByRole('link',{name:'Lidlar'}));expect(await screen.findByRole('heading',{name:'Lidlar'})).toBeInTheDocument();expect(await screen.findByText('Azizbek Rahmonov')).toBeInTheDocument()
  })

  it('открывает финансовый раздел', async () => {
    const user=userEvent.setup();renderApp();await user.type(screen.getByLabelText('Login'),'admin');await user.type(screen.getByLabelText('Parol'),'admin123');await user.click(screen.getByRole('button',{name:'Kirish'}));await user.click(await screen.findByRole('link',{name:'Moliya'}));expect(await screen.findByRole('heading',{name:'Moliya'})).toBeInTheDocument();expect(await screen.findByText('Sardor Abdullayev', {}, { timeout: 10000 })).toBeInTheDocument();expect(screen.getByRole('button',{name:'Oyliklar'})).toBeInTheDocument()
  })

  it('shows one contextual finance action per tab', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Moliya' }))
    await screen.findByText('Sardor Abdullayev')

    expect(screen.queryByRole('button', { name: 'Yangi to‘lov' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'To‘lov qo‘shish' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Xarajatlar' }))
    expect(screen.queryByRole('button', { name: 'Yangi xarajat' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Xarajat qo‘shish' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Xarajat qo‘shish' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Xarajat qo‘shish')
    expect(screen.getByLabelText('Kategoriya')).toBeInTheDocument()
    expect(screen.queryByLabelText('Guruh')).not.toBeInTheDocument()
  })

  it('renders readable finance rows and localized dates', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Moliya' }))

    const table = await screen.findByRole('table', { name: 'To‘lovlar ro‘yxati' })
    expect(within(table).getByText('05.07.2026')).toBeInTheDocument()
    const cells = within(within(table).getAllByRole('row')[1]).getAllByRole('cell')
    expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual([
      'O‘quvchi', 'Guruh', 'Usul', 'Sana', 'Summa',
    ])
  })

  it('shows salary payout action in Oyliklar', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Moliya' }))
    await screen.findByText('Sardor Abdullayev')

    await user.click(screen.getByRole('button', { name: 'Oyliklar' }))
    expect(screen.getByRole('columnheader', { name: 'Amal' })).toBeInTheDocument()
    expect(screen.getAllByText('Foiz').length).toBeGreaterThan(0)
    expect(screen.getByText(/O[‘']quvchi bo[‘']yicha/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Oylik berish' }).length).toBeGreaterThan(0)

    await user.click(screen.getAllByRole('button', { name: 'Oylik berish' })[0])
    expect(screen.getByRole('alertdialog', { name: /Oylik/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Oylikni berish' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bekor qilish' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('разделяет финансовые операции и отчёты', async () => {
    const user=userEvent.setup();renderApp();await user.type(screen.getByLabelText('Login'),'admin');await user.type(screen.getByLabelText('Parol'),'admin123');await user.click(screen.getByRole('button',{name:'Kirish'}));await user.click(await screen.findByRole('link',{name:'Moliya'}));expect(await screen.findByRole('button',{name:'Operatsiyalar'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Qarzlar'})).not.toBeInTheDocument();await user.click(screen.getByRole('button',{name:'To‘lov qo‘shish'}));expect(screen.getByLabelText('Guruh')).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Yopish'}));await user.click(screen.getByRole('link',{name:'Hisobotlar'}));expect(await screen.findByRole('heading',{name:'Hisobotlar'})).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Qarzlar'}));expect(await screen.findByRole('table',{name:'Qarzdorlar ro‘yxati'})).toBeInTheDocument()
  })

  it('фильтрует учеников по выбранной группе при добавлении платежа', async () => {
    const user=userEvent.setup();renderApp();await user.type(screen.getByLabelText('Login'),'admin');await user.type(screen.getByLabelText('Parol'),'admin123');await user.click(screen.getByRole('button',{name:'Kirish'}));await user.click(await screen.findByRole('link',{name:'Moliya'}));await user.click(await screen.findByRole('button',{name:'To‘lov qo‘shish'}));expect(screen.queryByLabelText('O‘quvchi ID')).not.toBeInTheDocument();const group=screen.getByRole('combobox',{name:'Guruh'});expect(group).not.toHaveAttribute('list');await user.click(group);expect(screen.getByRole('listbox',{name:'Guruh variantlari'})).toBeInTheDocument();await user.click(screen.getByRole('option',{name:'IELTS-24-01'}));await user.click(screen.getByRole('combobox',{name:'O‘quvchi'}));expect(screen.getByRole('option',{name:'Sardor Abdullayev · ST101'})).toBeInTheDocument();expect(screen.queryByRole('option',{name:'Sevinch Karimova · ST102'})).not.toBeInTheDocument()
  })

  it('позволяет выбрать статус нового лида', async () => {
    const user=userEvent.setup();renderApp();await user.type(screen.getByLabelText('Login'),'admin');await user.type(screen.getByLabelText('Parol'),'admin123');await user.click(screen.getByRole('button',{name:'Kirish'}));await user.click(await screen.findByRole('link',{name:'Lidlar'}));await user.click(await screen.findByRole('button',{name:'Lid qo‘shish'}));expect(screen.getByLabelText('Boshlang‘ich holat')).toBeInTheDocument()
  })

  it('выполняет вход преподавателя', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'teacher')
    await user.type(screen.getByLabelText('Parol'), 'teacher123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByText('Alisher Karimov')).toBeInTheDocument()
  })

  it('скрывает административные разделы от преподавателя', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'teacher')
    await user.type(screen.getByLabelText('Parol'), 'teacher123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByRole('navigation', { name: 'Asosiy navigatsiya' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Moliya' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Xodimlar' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sozlamalar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reyting' })).toBeInTheDocument()
  })

  it('показывает ошибку для неверных данных', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'wrong')
    await user.type(screen.getByLabelText('Parol'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Login yoki parol noto‘g‘ri")
  })
  it('opens exams and saves a student score', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Imtihonlar' }))

    expect(await screen.findByRole('heading', { name: 'Imtihonlar' })).toBeInTheDocument()
    expect((await screen.findAllByText('Mock IELTS Listening')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Natijalarni saqlash' })).not.toBeInTheDocument()

    const score = screen.getByLabelText('Sardor Abdullayev ball')
    await user.clear(score)
    await user.type(score, '35')
    expect(screen.getByText('Saqlanmagan o‘zgarishlar')).toBeInTheDocument()
    const saveButton = screen.getByRole('button', { name: 'Natijalarni saqlash' })
    const table = screen.getByRole('table', { name: 'Imtihon natijalari' })
    expect(table.compareDocumentPosition(saveButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(saveButton)

    expect(await screen.findByDisplayValue('35')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Imtihon natijalari' })).toBeInTheDocument()
  })

  it('creates a new exam from active group students', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Imtihonlar' }))
    await user.click(await screen.findByRole('button', { name: 'Imtihon qo‘shish' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Imtihon qo‘shish')
    await user.type(screen.getByLabelText('Nomi'), 'Grammar Final')
    await user.selectOptions(screen.getByLabelText('Guruh'), 'g1')
    await user.clear(screen.getByLabelText('Maksimal ball'))
    await user.type(screen.getByLabelText('Maksimal ball'), '50')
    await user.click(screen.getByRole('button', { name: 'Saqlash' }))

    expect(await screen.findByRole('heading', { name: 'Grammar Final' })).toBeInTheDocument()
    expect(screen.getByLabelText('Sardor Abdullayev ball')).toBeInTheDocument()
  }, 15_000)

  it('opens announcements and sends a group announcement', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'E’lonlar' }))

    expect(await screen.findByRole('heading', { name: 'E’lonlar' })).toBeInTheDocument()
    expect(await screen.findByText('Iyul oyi to‘lovlari')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'E’lon yuborish' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('E’lon yuborish')
    await user.selectOptions(screen.getByLabelText('Kimga'), 'group')
    await user.selectOptions(screen.getByLabelText('Guruh'), 'g1')
    await user.type(screen.getByLabelText('Sarlavha'), 'Dars vaqti')
    await user.type(screen.getByLabelText('Matn'), 'Bugungi dars 30 daqiqa kech boshlanadi.')
    await user.click(screen.getByRole('button', { name: 'Yuborish' }))

    expect(await screen.findByText('Dars vaqti')).toBeInTheDocument()
    expect(screen.getAllByText('Yetkazildi').length).toBeGreaterThan(0)
  }, 15_000)

  it('keeps announcement status in mobile card header', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'E’lonlar' }))

    const title = await screen.findByText('Iyul oyi to‘lovlari')
    const card = title.closest('article')
    expect(card?.querySelector('header')).toHaveClass('announcement-card-header')
    expect(title.parentElement).toHaveClass('announcement-card-content')
    expect(card?.querySelector('.announcement-status')).toHaveTextContent('Yetkazildi')
    expect(card).toHaveTextContent('06.07.2026')
  })

  it('schedules an announcement for later delivery', async () => {
    const user = userEvent.setup({ delay: null })
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'E’lonlar' }))
    await user.click(await screen.findByRole('button', { name: 'E’lon yuborish' }))

    await user.selectOptions(screen.getByLabelText('Yuborish vaqti'), 'scheduled')
    await user.type(screen.getByLabelText('Rejalangan vaqt'), '2026-07-09T14:30')
    await user.type(screen.getByLabelText('Sarlavha'), 'Ertangi yig‘ilish')
    await user.type(screen.getByLabelText('Matn'), 'Ertaga ota-onalar yig‘ilishi bo‘ladi.')
    await user.click(screen.getByRole('button', { name: 'Yuborish' }))

    expect(await screen.findByText('Ertangi yig‘ilish', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getAllByText('Rejalangan').length).toBeGreaterThan(0)
  })

  it('hides announcements from teacher until ownership filtering exists', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'teacher')
    await user.type(screen.getByLabelText('Parol'), 'teacher123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    expect(await screen.findByRole('navigation', { name: 'Asosiy navigatsiya' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'E’lonlar' })).not.toBeInTheDocument()
  })
  it('shows full reports tabs and export actions', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Hisobotlar' }))

    expect(await screen.findByRole('heading', { name: 'Hisobotlar' })).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: 'Tushumlar hisoboti' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Eksport' }))
    expect(screen.getByRole('button', { name: 'Excel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument()
    expect(screen.queryByText('Tushumlar dinamikasi')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'To‘lovlar tafsiloti' })).toBeInTheDocument()
    const incomeTable = screen.getByRole('table', { name: 'Tushumlar hisoboti' })
    expect(within(incomeTable).getByText('05.07.2026')).toBeInTheDocument()
    const studentName = within(incomeTable).getByText('Sardor Abdullayev')
    const studentCode = within(incomeTable).getByText('ST101')
    expect(studentName.compareDocumentPosition(studentCode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(studentName.closest('td')).toHaveAttribute('data-label', 'O‘quvchi')

    await user.click(screen.getByRole('button', { name: 'Davomat' }))
    expect(await screen.findByRole('table', { name: 'Akademik davomat hisoboti' })).toBeInTheDocument()
    expect(screen.getByTestId('reports-summary')).toHaveTextContent('Keldi')
    expect(screen.queryByText('came')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Imtihonlar' }))
    expect(await screen.findByRole('table', { name: 'Imtihonlar analitikasi' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kirim-chiqim' }))
    expect(await screen.findByRole('table', { name: 'Kirim-chiqim hisoboti' })).toBeInTheDocument()
  })

  it('opens placeholder sections from TZ', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    await user.click(await screen.findByRole('link', { name: 'Dars jadvali' }))
    expect(await screen.findByRole('heading', { name: 'Dars jadvali' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Reyting' }))
    expect(await screen.findByRole('heading', { name: 'Reyting' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Xodimlar' }))
    expect(await screen.findByRole('heading', { name: 'Xodimlar' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Telegram Bot' }))
    expect(await screen.findByRole('heading', { name: 'Telegram Bot' })).toBeInTheDocument()
  }, 15_000)

  it('builds schedule from active groups and allows manual lesson', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Dars jadvali' }))

    expect(await screen.findByRole('heading', { name: 'Dars jadvali' })).toBeInTheDocument()
    expect(await screen.findAllByText('IELTS-24-01')).toHaveLength(3)

    await user.selectOptions(screen.getByLabelText('Hafta kuni'), 'Se')
    expect(screen.getByText('ENG-24-03')).toBeInTheDocument()
    expect(screen.queryByText('IELTS-24-01')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Kalendar' }))
    expect(screen.getByRole('heading', { name: 'Se' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: "Dars qo'shish" }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent("Dars qo'shish")
    await user.selectOptions(within(dialog).getByLabelText('Guruh'), 'g1')
    expect(within(dialog).getByLabelText('Kurs')).toHaveValue('IELTS Intensive')
    expect(within(dialog).getByLabelText("O'qituvchi")).toHaveValue('Alisher Karimov')
    expect(within(dialog).getByLabelText('Auditoriya')).toHaveValue(101)
    await user.selectOptions(within(dialog).getByLabelText('Kun'), 'Se')
    await user.clear(within(dialog).getByLabelText('Vaqt'))
    await user.type(within(dialog).getByLabelText('Vaqt'), '14:30')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))

    expect(await screen.findByText("Qo'lda")).toBeInTheDocument()
  })

  it('supports Google Calendar style scope selection for recurring schedule edit and delete', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Dars jadvali' }))

    expect(await screen.findByRole('heading', { name: 'Dars jadvali' })).toBeInTheDocument()

    // Test single lesson deletion scope prompt
    const deleteButtons = await screen.findAllByRole('button', { name: /darsini o'chirish/i })
    await user.click(deleteButtons[0])

    const scopeModal = await screen.findByRole('dialog')
    expect(scopeModal).toHaveTextContent("Darsni o'chirish")
    expect(scopeModal).toHaveTextContent('Faqat ushbu dars uchun')
    expect(scopeModal).toHaveTextContent('Ushbu va barcha keyingi darslar uchun')

    // Click 'Faqat ushbu dars uchun'
    await user.click(within(scopeModal).getByRole('button', { name: /Faqat ushbu dars uchun/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens rating leaderboard with group filter and scores', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Reyting' }))

    expect(await screen.findByRole('heading', { name: 'Reyting' })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: "O'quvchilar reytingi" })
    expect(table).toBeInTheDocument()
    expect(await within(table).findByText('Sardor Abdullayev')).toBeInTheDocument()
    expect(within(table).getAllByText('95%').length).toBeGreaterThan(0)
    const firstRowCells = within(within(table).getAllByRole('row')[1]).getAllByRole('cell')
    expect(firstRowCells.map((cell) => cell.getAttribute('data-label'))).toEqual([
      'Joy', "O'quvchi", 'Guruh', 'Imtihon', 'Davomat', 'Uy vazifasi', 'Baho', 'Ball',
    ])

    await user.selectOptions(screen.getByLabelText('Guruh reytingi'), 'ENG-24-03')
    expect(within(table).getByText('Dilnoza Ergasheva')).toBeInTheDocument()
    expect(within(table).queryByText('Sardor Abdullayev')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Reyting qidirish'), 'ST103')
    expect(within(table).getByText('Dilnoza Ergasheva')).toBeInTheDocument()
    expect(within(table).queryByText('Aziza Rahimova')).not.toBeInTheDocument()
  })

  it('manages staff accounts with role filter and status toggle', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Xodimlar' }))

    expect(await screen.findByRole('heading', { name: 'Xodimlar' })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: "Xodimlar ro'yxati" })
    expect(await within(table).findByText('Dilshod Valiev')).toBeInTheDocument()
    expect(within(table).getByText('+998 90 123 45 67')).toBeInTheDocument()
    const staffCells = within(within(table).getAllByRole('row')[1]).getAllByRole('cell')
    expect(staffCells.map((cell) => cell.getAttribute('data-label'))).toEqual([
      'Xodim', 'Telefon', 'Rol', 'Holat', 'Oylik', 'Amallar',
    ])

    await user.selectOptions(screen.getByLabelText('Rol'), 'admin')
    expect(within(table).getByText('Nargiza Sobirova')).toBeInTheDocument()
    expect(within(table).getByText('Dilshod Valiev')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Rol'), 'all')
    await user.click(screen.getByText('Dilshod Valiev'))
    expect(screen.getByRole('heading', { name: 'Dilshod Valiev' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Profil fonini yopish' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bloklash' }))
    expect(await screen.findByRole('button', { name: 'Faollashtirish' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: "Xodim qo'shish" }))
    const dialog = screen.getByRole('dialog')
    expect(Array.from(dialog.querySelectorAll('input, select'), (field) => field.getAttribute('name'))).toEqual([
      'fullName', 'phone', 'hiredAt', 'salaryUzs', 'role', 'login', 'password',
    ])
    await user.type(within(dialog).getByLabelText('Ism familiya'), 'Madina Operator')
    await user.type(within(dialog).getByLabelText('Login'), 'madina.operator')
    await user.type(within(dialog).getByLabelText('Telefon'), '95 555 66 77')
    await user.selectOptions(within(dialog).getByLabelText('Rol'), 'admin')
    const password = within(dialog).getByLabelText('Parol')
    expect(password).toHaveAttribute('type', 'password')
    await user.type(password, 'secure123')
    await user.click(within(dialog).getByRole('button', { name: "Parolni ko'rsatish" }))
    expect(password).toHaveAttribute('type', 'text')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))

    expect(await within(table).findByText('Madina Operator')).toBeInTheDocument()
  }, 15_000)

  it('manages telegram links and queues test notification', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Telegram Bot' }))

    expect(await screen.findByRole('heading', { name: 'Telegram Bot' })).toBeInTheDocument()
    const linksTable = await screen.findByRole('table', { name: 'Telegram ulanishlari' })
    expect(await within(linksTable).findByText('Sardor Abdullayev')).toBeInTheDocument()

    await user.click(within(linksTable).getByRole('button', { name: 'Tasdiqlash' }))
    await user.selectOptions(screen.getByLabelText('Telegram link holati'), 'active')
    expect(await within(linksTable).findByText('Sardor Abdullayev')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Telegram trigger'), 'exam_result')
    await user.click(within(linksTable).getAllByRole('button', { name: 'Test yuborish' })[0])

    const logTable = await screen.findByRole('table', { name: 'Telegram notification log' })
    expect(await within(logTable).findByText('Imtihon natijasi')).toBeInTheDocument()
    expect(within(logTable).getAllByText('Navbatda').length).toBeGreaterThan(0)
  })

  it('renders compact telegram mobile workflow', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Telegram Bot' }))

    const online = await screen.findByText('Online')
    expect(online.parentElement).toHaveClass('telegram-summary-content')
    expect(online.parentElement).toHaveTextContent('Bot holatiOnlinepolling')
    expect(screen.getByRole('heading', { name: 'Test xabari' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Xabarlar jurnali' })).toBeInTheDocument()
    expect(screen.queryByText(/Test yuborish faqat faol link/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Push triggerlar' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Telegram link holati'), 'all')
    const linksTable = screen.getByRole('table', { name: 'Telegram ulanishlari' })
    const linkRow = await within(linksTable).findByText('Sardor Abdullayev').then((element) => element.closest('tr'))
    expect(linkRow?.querySelector('[data-label="O‘quvchi"]')).toBeInTheDocument()
    expect(linkRow?.querySelector('[data-label="Amallar"]')).toBeInTheDocument()
    expect(linkRow).toHaveTextContent('07.07.2026')
    const studentName = within(linkRow as HTMLTableRowElement).getByText('Sardor Abdullayev')
    const studentCode = within(linkRow as HTMLTableRowElement).getByText('ST101')
    expect(studentName.compareDocumentPosition(studentCode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const logTable = screen.getByRole('table', { name: 'Telegram notification log' })
    const logRow = within(logTable).getByText('ST105 davomat holati yuborildi').closest('tr')
    expect(logRow?.querySelector('[data-label="Xabar"]')).toBeInTheDocument()
    expect(logRow?.querySelector('[data-label="Yuborilgan vaqt"]')).toBeInTheDocument()
    expect(logRow).toHaveTextContent('Shahnoza Rahimova')
    expect(logRow).toHaveTextContent('Aziza Rahimova · ST105')
    expect(logRow).toHaveTextContent('1/3')
    expect(logRow).not.toHaveTextContent('782905555')
    expect(logRow).not.toHaveTextContent('tg-job-nl-1')
    await user.click(within(logRow as HTMLTableRowElement).getByRole('button', { name: 'Ko‘rish' }))
    const detailsDialog = screen.getByRole('dialog', { name: 'Xabar tafsilotlari' })
    expect(detailsDialog).toHaveTextContent('782905555')
    expect(detailsDialog).toHaveTextContent('tg-job-nl-1')
    expect(detailsDialog).not.toHaveTextContent('XatoYo‘q')
  })

  it('opens settings and saves center configuration', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'admin')
    await user.type(screen.getByLabelText('Parol'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Sozlamalar' }))

    expect(await screen.findByRole('heading', { name: 'Sozlamalar' })).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Golden Study CRM')).toBeInTheDocument()
    expect(screen.queryByText('PNG yoki JPG · 5 MB gacha')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Logo yuklash')).toHaveAttribute('type', 'file')
    expect(screen.queryByRole('button', { name: 'Logo yuklash' })).not.toBeInTheDocument()
    const languageButton = screen.getByRole('button', { name: 'Interfeys tilini o‘zgartirish' })
    expect(languageButton).toHaveTextContent('UZ')
    await user.click(languageButton)
    expect(languageButton).toHaveTextContent('RU')
    expect(screen.getByRole('heading', { name: 'Shaxsiy ma’lumotlar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Xavfsizlik' })).toBeInTheDocument()
    expect(screen.getByLabelText('F.I.Sh. (To‘liq ism)')).toBeInTheDocument()
    expect(screen.getByLabelText('Hozirgi parol')).toBeInTheDocument()
    expect(screen.queryByLabelText('Telegram username')).not.toBeInTheDocument()
    const adminStats = await screen.findByLabelText('Super admin ko‘rsatkichlari')
    expect(adminStats).toHaveTextContent('Guruhlar')
    expect(adminStats).toHaveTextContent('O‘quvchilar')
    expect(adminStats).toHaveTextContent('O‘qituvchilar')
    expect(adminStats).toHaveTextContent('Oxirgi oy foydasi')
    expect(adminStats).toHaveTextContent('Oxirgi oy xarajati')
    expect(screen.getByRole('button', { name: 'Markazni saqlash' })).toBeDisabled()

    await user.clear(screen.getByLabelText('Tizim nomi'))
    await user.type(screen.getByLabelText('Tizim nomi'), 'Golden Study Academy')
    expect(screen.getByRole('button', { name: 'Markazni saqlash' })).toBeEnabled()
    expect(screen.queryByLabelText('Billing rejimi')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Markazni saqlash' }))

    expect(screen.queryByText(/billing/i)).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Golden Study Academy' })).toBeInTheDocument()
    expect(screen.queryByText('Filial')).not.toBeInTheDocument()
  }, 10_000)

  it('shows a private teacher dashboard and blocks admin routes', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'teacher')
    await user.type(screen.getByLabelText('Parol'), 'teacher123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByRole('heading', { name: 'O\'qituvchi paneli' })).toBeInTheDocument()
    expect(await screen.findByText('IELTS-24-01')).toBeInTheDocument()
    expect(screen.getAllByText('Alisher Karimov').length).toBeGreaterThan(0)
    expect(screen.queryByText('So\'nggi to\'lovlar')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bosh sahifa' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Moliya' })).not.toBeInTheDocument()

    window.history.pushState({}, '', '/finance')
    window.dispatchEvent(new PopStateEvent('popstate'))

    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(await screen.findByRole('heading', { name: 'O\'qituvchi paneli' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Moliya' })).not.toBeInTheDocument()
  })

  it('opens attendance for the selected dashboard lesson', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'teacher')
    await user.type(screen.getByLabelText('Parol'), 'teacher123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'ENG-24-03 davomatini ochish' }))
    expect(await screen.findByRole('heading', { name: 'Davomat' })).toBeInTheDocument()
    await screen.findByRole('option', { name: 'ENG-24-03' })
    expect(screen.getByRole('combobox', { name: 'Guruh' })).toHaveValue('g2')
  })

  it('shows only the current teacher schedule in read-only mode', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'teacher')
    await user.type(screen.getByLabelText('Parol'), 'teacher123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Dars jadvali' }))

    expect(await screen.findByRole('heading', { name: 'Dars jadvali' })).toBeInTheDocument()
    expect(await screen.findAllByText('IELTS-24-01')).not.toHaveLength(0)
    expect(screen.getAllByText('ENG-24-03')).not.toHaveLength(0)
    expect(screen.queryByText('PY-24-01')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "Dars qo'shish" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("O'qituvchi")).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'ENG-24-03 Se davomatini ochish' }))
    await screen.findByRole('option', { name: 'ENG-24-03' })
    expect(screen.getByRole('combobox', { name: 'Guruh' })).toHaveValue('g2')
  })

  it('lets teacher edit attendance only for owned and unlocked rows', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'teacher')
    await user.type(screen.getByLabelText('Parol'), 'teacher123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Davomat' }))

    expect(await screen.findByRole('heading', { name: 'Davomat' })).toBeInTheDocument()
    await screen.findByRole('option', { name: 'IELTS-24-01' })
    const group = screen.getByRole('combobox', { name: 'Guruh' })
    expect(within(group).getByRole('option', { name: 'IELTS-24-01' })).toBeInTheDocument()
    expect(within(group).getByRole('option', { name: 'ENG-24-03' })).toBeInTheDocument()
    expect(within(group).queryByRole('option', { name: 'PY-24-01' })).not.toBeInTheDocument()

    expect(await screen.findByRole('button', { name: 'Sardor Abdullayev: Sababsiz' })).toBeDisabled()
    expect(screen.getByLabelText('Sardor Abdullayev izoh')).toBeDisabled()
    const editableStatus = await screen.findByRole('button', { name: 'Aziza Rahimova: Sababsiz' })
    const editableComment = screen.getByLabelText('Aziza Rahimova izoh')
    await user.click(editableStatus)
    await user.clear(editableComment)
    await user.type(editableComment, 'Yaxshi ishladi')
    await user.click(screen.getByRole('button', { name: 'Saqlash' }))
    expect(editableStatus).toHaveClass('absent')
    expect(editableComment).toHaveValue('Yaxshi ishladi')
  })

  it('shows teacher rating only for owned students in read-only mode', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'teacher')
    await user.type(screen.getByLabelText('Parol'), 'teacher123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Reyting' }))

    expect(await screen.findByRole('heading', { name: 'Reyting' })).toBeInTheDocument()
    expect((await screen.findAllByText('Sardor Abdullayev')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Aziza Rahimova').length).toBeGreaterThan(0)
    expect(screen.queryByText('Sevinch Karimova')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /saqlash/i })).not.toBeInTheDocument()
    const ratingGroup = screen.getByRole('combobox', { name: 'Guruh reytingi' })
    await user.selectOptions(ratingGroup, 'ENG-24-03')
    expect(screen.getAllByText('Dilnoza Ergasheva').length).toBeGreaterThan(0)
    expect(screen.queryByText('Sardor Abdullayev')).not.toBeInTheDocument()
  })

  it('lets teacher manage exams only for owned groups', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByLabelText('Login'), 'teacher')
    await user.type(screen.getByLabelText('Parol'), 'teacher123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Imtihonlar' }))

    expect(await screen.findByRole('heading', { name: 'Imtihonlar' })).toBeInTheDocument()
    expect((await screen.findAllByText('Mock IELTS Listening')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('07.07.2026').length).toBeGreaterThan(0)
    expect(screen.queryByText('Unit 3 Vocabulary')).not.toBeInTheDocument()

    const score = screen.getByLabelText('Sardor Abdullayev ball')
    await user.clear(score)
    await user.type(score, '36')
    await user.click(screen.getByRole('button', { name: 'Natijalarni saqlash' }))
    expect(score).toHaveValue(36)
  })

  it('lets teacher create an exam for an owned group', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'teacher')
    await user.type(screen.getByLabelText('Parol'), 'teacher123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('link', { name: 'Imtihonlar' }))
    await user.click(await screen.findByRole('button', { name: "Imtihon qo'shish" }))
    await user.type(screen.getByLabelText('Nomi'), 'Progress Test')
    await user.selectOptions(screen.getByLabelText('Guruh'), 'g2')
    await user.clear(screen.getByLabelText('Maksimal ball'))
    await user.type(screen.getByLabelText('Maksimal ball'), '50')
    await user.click(screen.getByRole('button', { name: 'Saqlash' }))
    expect((await screen.findAllByText('Progress Test')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('ENG-24-03').length).toBeGreaterThan(0)
  })

  it('lets teacher add student to own group and restricts admin actions', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('Login'), 'teacher')
    await user.type(screen.getByLabelText('Parol'), 'teacher123')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    const nav = await screen.findByRole('navigation', { name: 'Asosiy navigatsiya' })
    expect(within(nav).getByRole('link', { name: 'O‘quvchilar' })).toBeInTheDocument()
    await user.click(within(nav).getByRole('link', { name: 'O‘quvchilar' }))

    expect(await screen.findByRole('heading', { name: 'O‘quvchilar' })).toBeInTheDocument()
    expect(screen.getByText('Faqat sizning guruhlaringizdagi o‘quvchilar')).toBeInTheDocument()

    // Actions restricted for teacher in table
    await user.click(screen.getByRole('button', { name: 'ST101 amallari' }))
    const menu = screen.getByRole('menu', { name: 'ST101 amallari' })
    expect(within(menu).queryByRole('menuitem', { name: /To‘lov qabul qilish/i })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: /O‘chirish/i })).not.toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /O‘quvchi kartasi/i })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Tahrirlash/i })).toBeInTheDocument()

    // Add student
    await user.click(screen.getByRole('button', { name: 'O‘quvchi qo‘shish' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('O‘quvchi ma’lumotlari va guruhingizga biriktirish')).toBeInTheDocument()

    const groupSelect = within(dialog).getByRole('combobox', { name: /Guruh/ })
    expect(groupSelect).toBeRequired()
    expect(within(groupSelect).queryByText('Guruhsiz')).not.toBeInTheDocument()
    expect(within(groupSelect).getByText(/IELTS-24-01/)).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Ism familiya'), 'Sherzod Qodirov')
    await user.type(within(dialog).getByLabelText('Telefon'), '901234567')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))

    expect(await screen.findByText('Sherzod Qodirov')).toBeInTheDocument()
  })
})
