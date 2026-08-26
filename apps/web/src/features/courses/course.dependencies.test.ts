import { expect, it } from 'vitest'

import { ApiCourseRepository } from './apiCourse.repository'
import { courseRepository } from './course.dependencies'

it('binds courses to real API repository', () => {
  expect(courseRepository).toBeInstanceOf(ApiCourseRepository)
})
