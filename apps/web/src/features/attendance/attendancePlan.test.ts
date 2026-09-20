import { describe, expect, it } from 'vitest'
import {
  calculateAttendanceAverage,
  formatLessonPlan,
  normalizeAttendanceRow,
  parseLessonPlan,
  parseScoreInput,
} from './attendancePlan'

describe('attendancePlan helpers', () => {
  describe('parseLessonPlan & formatLessonPlan', () => {
    it('correctly formats and parses combined topic and homework', () => {
      const formatted = formatLessonPlan('Past Simple tense', 'Exercises 1-4, page 55')
      expect(formatted).toBe('Mavzu: Past Simple tense\nVazifa: Exercises 1-4, page 55')

      const parsed = parseLessonPlan(formatted)
      expect(parsed.topic).toBe('Past Simple tense')
      expect(parsed.homeworkText).toBe('Exercises 1-4, page 55')
    })

    it('handles topic only', () => {
      const formatted = formatLessonPlan('Present Perfect', '')
      expect(formatted).toBe('Mavzu: Present Perfect')

      const parsed = parseLessonPlan(formatted)
      expect(parsed.topic).toBe('Present Perfect')
      expect(parsed.homeworkText).toBe('')
    })

    it('handles legacy homework text without Mavzu prefix', () => {
      const legacy = 'Mashqlar 1-4'
      const parsed = parseLessonPlan(legacy)
      expect(parsed.topic).toBe('')
      expect(parsed.homeworkText).toBe('Mashqlar 1-4')
    })

    it('handles empty inputs', () => {
      expect(parseLessonPlan('')).toEqual({ topic: '', homeworkText: '' })
      expect(formatLessonPlan('', '')).toBe('')
    })
  })

  describe('calculateAttendanceAverage (Skip Empty)', () => {
    it('returns null when all score fields are null or undefined', () => {
      expect(calculateAttendanceAverage(null, null, null)).toBeNull()
      expect(calculateAttendanceAverage(undefined, undefined, undefined)).toBeNull()
      expect(calculateAttendanceAverage()).toBeNull()
    })

    it('calculates average from only entered scores, skipping nulls', () => {
      // Only homework entered
      expect(calculateAttendanceAverage(100, null, null)).toBe(100)
      // Homework and topic entered
      expect(calculateAttendanceAverage(80, 90, null)).toBe(85)
      // All three entered
      expect(calculateAttendanceAverage(90, 95, 100)).toBe(95)
    })

    it('does NOT skip 0 when 0 is explicitly passed as a score', () => {
      // Student was given 0 for homework, others empty
      expect(calculateAttendanceAverage(0, null, null)).toBe(0)
      // Student was given 0 for homework, 100 for topic
      expect(calculateAttendanceAverage(0, 100, null)).toBe(50)
      // All three zeros
      expect(calculateAttendanceAverage(0, 0, 0)).toBe(0)
    })
  })

  describe('parseScoreInput', () => {
    it('returns null for empty or whitespace strings', () => {
      expect(parseScoreInput('')).toBeNull()
      expect(parseScoreInput('   ')).toBeNull()
    })

    it('parses valid numeric strings', () => {
      expect(parseScoreInput('0')).toBe(0)
      expect(parseScoreInput('100')).toBe(100)
      expect(parseScoreInput('85')).toBe(85)
    })

    it('clamps values between 0 and 100', () => {
      expect(parseScoreInput('120')).toBe(100)
      expect(parseScoreInput('-10')).toBe(0)
    })

    it('returns null for non-numeric input', () => {
      expect(parseScoreInput('abc')).toBeNull()
    })
  })

  describe('normalizeAttendanceRow', () => {
    it('normalizes legacy empty row to have null scores and rating', () => {
      const raw = {
        studentId: 's1',
        studentCode: 'ST1',
        studentName: 'Ali',
        status: 'came' as const,
        rating: 0,
        homeworkDone: false,
        homeworkScore: 0,
        topicScore: 0,
        dictionaryScore: 0,
        comment: '',
        lockedByAdmin: false,
      }
      const norm = normalizeAttendanceRow(raw)
      expect(norm.homeworkScore).toBeNull()
      expect(norm.topicScore).toBeNull()
      expect(norm.dictionaryScore).toBeNull()
      expect(norm.rating).toBeNull()
    })

    it('preserves existing scores when homework was done or rating was set', () => {
      const graded = {
        studentId: 's2',
        studentCode: 'ST2',
        studentName: 'Vali',
        status: 'came' as const,
        rating: 90,
        homeworkDone: true,
        homeworkScore: 90,
        topicScore: 90,
        dictionaryScore: 90,
        comment: '',
        lockedByAdmin: false,
      }
      const norm = normalizeAttendanceRow(graded)
      expect(norm.homeworkScore).toBe(90)
      expect(norm.topicScore).toBe(90)
      expect(norm.dictionaryScore).toBe(90)
      expect(norm.rating).toBe(90)
    })

    it('preserves an explicit 0 score when other scores are empty/null', () => {
      const partialZero = {
        studentId: 's3',
        studentCode: 'ST3',
        studentName: 'Gani',
        status: 'came' as const,
        rating: 0,
        homeworkDone: false,
        homeworkScore: 0,
        topicScore: null,
        dictionaryScore: null,
        comment: '',
        lockedByAdmin: false,
      }
      const norm = normalizeAttendanceRow(partialZero)
      expect(norm.homeworkScore).toBe(0)
      expect(norm.topicScore).toBeNull()
      expect(norm.dictionaryScore).toBeNull()
      expect(norm.rating).toBe(0)
    })

    it('populates scores from historical single rating for legacy rows', () => {
      const legacy = {
        studentId: 's4',
        studentCode: 'ST4',
        studentName: 'Nodir',
        status: 'came' as const,
        rating: 95,
        homeworkDone: true,
        comment: 'A’lo',
        lockedByAdmin: false,
      }
      const norm = normalizeAttendanceRow(legacy as any)
      expect(norm.homeworkScore).toBe(95)
      expect(norm.topicScore).toBe(95)
      expect(norm.dictionaryScore).toBe(95)
      expect(norm.rating).toBe(95)
    })
  })
})
