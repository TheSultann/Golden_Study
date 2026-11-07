import type {
  CreateSpeakingTopicInput,
  GradeSpeakingSubmissionInput,
  GradeStudentSpeakingInput,
  QuerySpeaking,
  SpeakingSubmission,
  SubmitSpeakingSubmissionInput,
} from '@golden-study/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { speakingRepository } from './speaking.dependencies'

const topicsKey = ['speaking-topics'] as const
const submissionsKey = ['speaking-submissions'] as const

export function useSpeakingTopics(groupId?: string) {
  return useQuery({
    queryKey: [...topicsKey, groupId ?? 'all'],
    queryFn: () => speakingRepository.listTopics(groupId),
  })
}

export function useCreateSpeakingTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSpeakingTopicInput) => speakingRepository.createTopic(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: topicsKey })
    },
  })
}

export function useSpeakingSubmissions(
  query?: QuerySpeaking,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [
      ...submissionsKey,
      query?.groupId ?? 'all',
      query?.topicId ?? 'all',
      query?.studentId ?? 'all',
      query?.status ?? 'all',
    ],
    queryFn: () => speakingRepository.listSubmissions(query),
    enabled: options?.enabled ?? true,
  })
}

export function useGradeSpeakingSubmission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: GradeSpeakingSubmissionInput }) =>
      speakingRepository.gradeSubmission(id, input),
    onSuccess: async (updated: SpeakingSubmission) => {
      queryClient.setQueriesData<SpeakingSubmission[]>({ queryKey: submissionsKey }, (old) => {
        if (!old) return [updated]
        return old.map((sub) => (sub.id === updated.id ? updated : sub))
      })
      await queryClient.invalidateQueries({ queryKey: submissionsKey })
    },
  })
}

export function useGradeStudentSpeaking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GradeStudentSpeakingInput) => speakingRepository.gradeStudent(input),
    onSuccess: async (updated: SpeakingSubmission) => {
      queryClient.setQueriesData<SpeakingSubmission[]>({ queryKey: submissionsKey }, (old) => {
        if (!old) return [updated]
        const idx = old.findIndex((s) => s.id === updated.id)
        if (idx >= 0) {
          return old.map((s) => (s.id === updated.id ? updated : s))
        }
        return [updated, ...old]
      })
      await queryClient.invalidateQueries({ queryKey: submissionsKey })
    },
  })
}

export function useSubmitSpeakingSubmission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SubmitSpeakingSubmissionInput) => speakingRepository.submitRecording(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: submissionsKey })
    },
  })
}
