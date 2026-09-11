import { describe, expect, it } from 'vitest'
import { teacherRatingResponseSchema } from '@golden-study/contracts'

describe('teacherRatingResponseSchema', () => {
  it('parses rows with 0 stars without schema validation error', () => {
    const rawData = {
      data: [
        {
          studentId: 's1',
          studentCode: 'ST101',
          studentName: 'Ali Valiyev',
          groupName: 'ENG-1',
          examsCount: 0,
          averagePercent: 0,
          attendanceRate: 0,
          attendanceRating: 0,
          homeworkRate: 0,
          totalScore: 0,
          stars: 0,
        },
      ],
    }

    const parsed = teacherRatingResponseSchema.parse(rawData)
    expect(parsed.data[0].stars).toBe(0)
  })

  it('parses rows with percentage attendanceRating (0-100)', () => {
    const rawData = {
      data: [
        {
          studentId: 's1',
          studentCode: 'ST101',
          studentName: 'Ali Valiyev',
          groupName: 'ENG-1',
          examsCount: 2,
          averagePercent: 88,
          attendanceRate: 95,
          attendanceRating: 92,
          homeworkRate: 90,
          totalScore: 91,
          stars: 5,
        },
      ],
    }

    const parsed = teacherRatingResponseSchema.parse(rawData)
    expect(parsed.data[0].attendanceRating).toBe(92)
  })
})
