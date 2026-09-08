import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StudentProfileDrawer } from './features/student-profile/StudentProfileDrawer'
import { createQueryClient } from './shared/query/queryClient'

vi.mock('./features/student-profile/studentProfile.dependencies', () => ({
  studentProfileRepository: {
    getById: vi.fn(async (id: string) => {
      if (id === 's3') {
        return {
          student: {
            id: 's3',
            code: 'ST103',
            firstName: 'Botir',
            lastName: 'Qodirov',
            birthDate: '2000-01-01',
            phone: '+998901234569',
            parentName: 'Ota-ona',
            parentPhone: '+998901234569',
            address: 'Toshkent',
            status: 'active',
            balance: 0,
            groups: [],
          },
          academicSummary: {
            ratingScore: null,
            groupPlace: null,
            examAveragePercent: null,
            attendancePercent: null,
            homeworkPercent: null,
          },
          updatedAt: '2026-07-21T00:00:00.000Z',
        }
      }
      return {
        student: {
          id: 's1',
          code: 'ST101',
          firstName: 'Sardor',
          lastName: 'Abdullayev',
          birthDate: '2000-01-01',
          phone: '+998901234567',
          parentName: 'Akmal Abdullayev',
          parentPhone: '+998907654321',
          address: 'Toshkent',
          status: 'active',
          balance: 150000,
          groups: ['g1'],
        },
        academicSummary: {
          ratingScore: 92,
          groupPlace: 2,
          examAveragePercent: 88,
          attendancePercent: 95,
          homeworkPercent: 90,
        },
        updatedAt: '2026-07-21T00:00:00.000Z',
      }
    }),
  },
}))

import * as authService from './features/auth/auth.service'

function renderDrawer(studentId: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <StudentProfileDrawer studentId={studentId} onClose={vi.fn()} onEdit={vi.fn()} />
    </QueryClientProvider>,
  )
}

describe('StudentProfileDrawer', () => {
  it('shows identity, academic summary, finance, contacts and To‘lov button for non-teacher', async () => {
    vi.spyOn(authService, 'getSession').mockReturnValue({
      id: 'u1',
      login: 'admin',
      name: 'Admin',
      role: 'admin',
    })

    renderDrawer('s1')

    const dialog = await screen.findByRole('dialog')
    await screen.findByText('ST101')
    expect(dialog).toHaveTextContent('ST101')
    expect(dialog).toHaveTextContent('O‘qish ko‘rsatkichlari')
    expect(dialog).toHaveTextContent('Faol')
    expect(dialog).toHaveTextContent('g1')
    expect(dialog).toHaveTextContent('Umumiy reyting')
    expect(dialog).toHaveTextContent('Guruhdagi o‘rni')
    expect(dialog).toHaveTextContent('Imtihonlar')
    expect(dialog).toHaveTextContent('Davomat')
    expect(dialog).toHaveTextContent('Uy vazifasi')
    expect(dialog).toHaveTextContent('Balans')
    expect(dialog).toHaveTextContent('Akmal Abdullayev')
    expect(screen.getByRole('button', { name: /to‘lov/i })).toBeInTheDocument()
  })

  it('hides To‘lov button when logged in as teacher', async () => {
    vi.spyOn(authService, 'getSession').mockReturnValue({
      id: 'u2',
      login: 'teacher',
      name: 'Teacher',
      role: 'teacher',
    })

    renderDrawer('s1')

    await screen.findByRole('dialog')
    await screen.findByText('ST101')
    expect(screen.queryByRole('button', { name: /to‘lov/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tahrirlash/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /yopish/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('renders missing academic values without fake zeros', async () => {
    vi.spyOn(authService, 'getSession').mockReturnValue(null)
    renderDrawer('s3')

    expect(await screen.findByText('Ma’lumot yetarli emas')).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })
})
