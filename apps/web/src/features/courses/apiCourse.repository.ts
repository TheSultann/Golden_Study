import {
  courseApiSchema,
  paginationMetaSchema,
  type Course,
  type CourseApi,
} from '@golden-study/contracts'
import { z } from 'zod'

import { apiRequest } from '../../shared/api/httpClient'
import type { CourseRepository } from './course.repository'

const courseListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(courseApiSchema),
  meta: paginationMetaSchema,
})
const courseApiResponseSchema = z.object({
  success: z.literal(true),
  data: courseApiSchema,
})

function toCourse(value: CourseApi): Course {
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    durationMonths: value.durationMonths,
    pricePerMonth: value.pricePerMonthUzs,
    groupsCount: value.groupsCount,
    studentsCount: value.studentsCount,
    active: value.isActive,
  }
}

function toInput(course: Course) {
  return {
    title: course.title,
    description: course.description,
    durationMonths: course.durationMonths,
    pricePerMonthUzs: course.pricePerMonth,
  }
}

export class ApiCourseRepository implements CourseRepository {
  async list(): Promise<Course[]> {
    const response = await apiRequest(
      '/courses?limit=100',
      { method: 'GET' },
      courseListApiResponseSchema,
    )
    return response.data.map(toCourse)
  }

  async create(course: Course): Promise<Course> {
    const response = await apiRequest(
      '/courses',
      { method: 'POST', body: JSON.stringify(toInput(course)) },
      courseApiResponseSchema,
    )
    return toCourse(response.data)
  }

  async update(course: Course): Promise<Course> {
    const response = await apiRequest(
      `/courses/${course.id}`,
      { method: 'PATCH', body: JSON.stringify(toInput(course)) },
      courseApiResponseSchema,
    )
    return toCourse(response.data)
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await apiRequest(
      `/courses/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ isActive: active }) },
      courseApiResponseSchema,
    )
  }
}
