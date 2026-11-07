import {
  speakingSubmissionListResponseSchema,
  speakingSubmissionResponseSchema,
  speakingTopicListResponseSchema,
  speakingTopicResponseSchema,
  type CreateSpeakingTopicInput,
  type GradeSpeakingSubmissionInput,
  type GradeStudentSpeakingInput,
  type QuerySpeaking,
  type SpeakingSubmission,
  type SpeakingTopic,
  type SubmitSpeakingSubmissionInput,
} from '@golden-study/contracts'

import { apiRequest } from '../../shared/api/httpClient'
import type { SpeakingRepository } from './speaking.repository'

export class ApiSpeakingRepository implements SpeakingRepository {
  async listTopics(groupId?: string): Promise<SpeakingTopic[]> {
    const url = groupId ? `/speaking/topics?groupId=${encodeURIComponent(groupId)}` : '/speaking/topics'
    const response = await apiRequest(url, { method: 'GET' }, speakingTopicListResponseSchema)
    return response.data
  }

  async createTopic(input: CreateSpeakingTopicInput): Promise<SpeakingTopic> {
    const response = await apiRequest(
      '/speaking/topics',
      { method: 'POST', body: JSON.stringify(input) },
      speakingTopicResponseSchema,
    )
    return response.data
  }

  async listSubmissions(query?: QuerySpeaking): Promise<SpeakingSubmission[]> {
    const params = new URLSearchParams()
    if (query?.topicId) params.append('topicId', query.topicId)
    if (query?.groupId) params.append('groupId', query.groupId)
    if (query?.studentId) params.append('studentId', query.studentId)
    if (query?.status) params.append('status', query.status)

    const qs = params.toString()
    const url = qs ? `/speaking/submissions?${qs}` : '/speaking/submissions'
    const response = await apiRequest(url, { method: 'GET' }, speakingSubmissionListResponseSchema)
    return response.data
  }

  async gradeSubmission(id: string, input: GradeSpeakingSubmissionInput): Promise<SpeakingSubmission> {
    const response = await apiRequest(
      `/speaking/submissions/${id}/grade`,
      { method: 'POST', body: JSON.stringify(input) },
      speakingSubmissionResponseSchema,
    )
    return response.data
  }

  async gradeStudent(input: GradeStudentSpeakingInput): Promise<SpeakingSubmission> {
    const response = await apiRequest(
      '/speaking/submissions/grade-student',
      { method: 'POST', body: JSON.stringify(input) },
      speakingSubmissionResponseSchema,
    )
    return response.data
  }

  async submitRecording(input: SubmitSpeakingSubmissionInput): Promise<SpeakingSubmission> {
    const response = await apiRequest(
      '/speaking/submissions',
      { method: 'POST', body: JSON.stringify(input) },
      speakingSubmissionResponseSchema,
    )
    return response.data
  }
}
