import { describe, expect, it } from 'vitest'

import { ApiTeacherRepository } from './apiTeacher.repository'
import { teacherRepository } from './teacher.dependencies'

describe('teacher.dependencies', () => {
  it('binds ApiTeacherRepository as production implementation', () => {
    expect(teacherRepository).toBeInstanceOf(ApiTeacherRepository)
  })
})
