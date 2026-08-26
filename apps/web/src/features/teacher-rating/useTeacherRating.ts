import { useQuery } from '@tanstack/react-query'
import { teacherRatingRepository } from './teacherRating.dependencies'
export const useTeacherRating = () => useQuery({ queryKey: ['teacher-rating'], queryFn: () => teacherRatingRepository.list() })
