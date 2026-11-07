import type {
  CreateSpeakingTopicInput,
  GradeSpeakingSubmissionInput,
  GradeStudentSpeakingInput,
  QuerySpeaking,
  SpeakingSubmission,
  SpeakingTopic,
  SubmitSpeakingSubmissionInput,
} from '@golden-study/contracts'

export interface SpeakingRepository {
  listTopics(groupId?: string): Promise<SpeakingTopic[]>
  createTopic(input: CreateSpeakingTopicInput): Promise<SpeakingTopic>
  listSubmissions(query?: QuerySpeaking): Promise<SpeakingSubmission[]>
  gradeSubmission(id: string, input: GradeSpeakingSubmissionInput): Promise<SpeakingSubmission>
  gradeStudent(input: GradeStudentSpeakingInput): Promise<SpeakingSubmission>
  submitRecording(input: SubmitSpeakingSubmissionInput): Promise<SpeakingSubmission>
}
