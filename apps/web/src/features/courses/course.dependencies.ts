import type { CourseRepository } from './course.repository'
import { ApiCourseRepository } from './apiCourse.repository'

export const courseRepository: CourseRepository = new ApiCourseRepository()
