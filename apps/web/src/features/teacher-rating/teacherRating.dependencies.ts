import { ApiTeacherRatingRepository } from './apiTeacherRating.repository'
import type { TeacherRatingRepository } from './teacherRating.repository'

export const teacherRatingRepository: TeacherRatingRepository = new ApiTeacherRatingRepository()
