import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Course } from '@golden-study/contracts'
import { courseRepository } from './course.dependencies'
const key = ['courses'] as const
export const useCourses = () => useQuery({ queryKey: key, queryFn: () => courseRepository.list() })
export function useSaveCourse() { const client = useQueryClient(); return useMutation({ mutationFn: (course: Course) => course.id.startsWith('new-') ? courseRepository.create(course) : courseRepository.update(course), onSuccess: async () => client.invalidateQueries({ queryKey: key }) }) }
export function useSetCourseActive() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => courseRepository.setActive(id, active), onSuccess: async () => client.invalidateQueries({ queryKey: key }) }) }
