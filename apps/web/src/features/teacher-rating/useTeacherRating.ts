import { useQuery } from '@tanstack/react-query'
import { getSession } from '../auth/auth.service'
import { teacherRatingRepository } from './teacherRating.dependencies'
export const useTeacherRating = () => {
  const session = getSession()
  return useQuery({ queryKey: ['teacher-rating', session?.id ?? 'me'], queryFn: () => teacherRatingRepository.list() })
}
