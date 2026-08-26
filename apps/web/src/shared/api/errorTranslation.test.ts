import { describe, expect, it } from 'vitest'
import { ApiError } from './apiError'
import { formatApiError, translateErrorMessage } from './errorTranslation'

describe('errorTranslation', () => {
  describe('translateErrorMessage', () => {
    it('should translate exact message if mapping exists', () => {
      expect(translateErrorMessage('Group name already exists')).toBe('Bunday nomli guruh allaqachon mavjud')
      expect(translateErrorMessage('Student not found')).toBe('O‘quvchi topilmadi')
      expect(translateErrorMessage('Teacher schedule conflict')).toBe('Tanlangan vaqtda o‘qituvchi band')
      expect(translateErrorMessage('Room schedule conflict')).toBe('Tanlangan vaqtda xona band')
    })

    it('should return original message if mapping does not exist', () => {
      expect(translateErrorMessage('Some random error')).toBe('Some random error')
    })
  })

  describe('formatApiError', () => {
    it('should format ApiError with mapped message', () => {
      const err = new ApiError(409, 'CONFLICT', 'Group name already exists')
      expect(formatApiError(err, 'Fallback')).toBe('Bunday nomli guruh allaqachon mavjud')
    })

    it('should format ApiError with code fallback if message is unmapped', () => {
      const err = new ApiError(403, 'FORBIDDEN', 'Access denied')
      expect(formatApiError(err, 'Fallback')).toBe('Ruxsat berilmadi')
    })

    it('should format VALIDATION_ERROR details using translateZodIssue', () => {
      const err = new ApiError(400, 'VALIDATION_ERROR', 'Validation error', [
        { path: ['name'], message: 'Required' },
        { path: ['phone'], message: 'Invalid phone number' },
      ])
      expect(formatApiError(err, 'Fallback')).toBe('Nomi: kiritilishi shart, Telefon raqami: noto‘g‘ri formatda')
    })

    it('should fall back to standard Error message', () => {
      const err = new Error('Access denied')
      expect(formatApiError(err, 'Fallback')).toBe('Ruxsat berilmadi')
    })

    it('should use fallback message for unknown errors', () => {
      expect(formatApiError({}, 'Fallback')).toBe('Fallback')
    })
  })
})
