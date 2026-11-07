import { z } from 'zod'

export const speakingSubmissionStatusSchema = z.enum([
  'PENDING_AI',
  'EVALUATED_BY_AI',
  'GRADED_BY_TEACHER',
])
export type SpeakingSubmissionStatus = z.infer<typeof speakingSubmissionStatusSchema>

export const speakingTopicSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  groupName: z.string(),
  teacherId: z.string(),
  title: z.string().min(1),
  description: z.string(),
  maxScore: z.number().int().positive(),
  deadline: z.string().nullable().optional(),
  createdAt: z.string(),
})
export type SpeakingTopic = z.infer<typeof speakingTopicSchema>

export const speakingSubmissionSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  studentCode: z.string(),
  audioUrl: z.string(),
  durationSeconds: z.number().int().min(0),
  transcript: z.string(),
  aiFeedback: z.string(),
  aiScore: z.number().nullable().optional(),
  teacherScore: z.number().nullable().optional(),
  teacherComment: z.string().nullable().optional(),
  status: speakingSubmissionStatusSchema,
  createdAt: z.string(),
})
export type SpeakingSubmission = z.infer<typeof speakingSubmissionSchema>

export const createSpeakingTopicSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().default(''),
  maxScore: z.number().int().positive().default(10),
  deadline: z.string().nullable().optional(),
})
export type CreateSpeakingTopicInput = z.infer<typeof createSpeakingTopicSchema>
export const CreateSpeakingTopicSchema = createSpeakingTopicSchema

export const gradeSpeakingSubmissionSchema = z.object({
  teacherScore: z.number().min(0),
  teacherComment: z.string().max(1000).default(''),
})
export type GradeSpeakingSubmissionInput = z.infer<typeof gradeSpeakingSubmissionSchema>
export const GradeSpeakingSubmissionSchema = gradeSpeakingSubmissionSchema

export const gradeStudentSpeakingSchema = z.object({
  studentId: z.string().min(1),
  topicId: z.string().optional(),
  groupId: z.string().optional(),
  teacherScore: z.number().min(0).max(10),
  teacherComment: z.string().max(1000).default(''),
})
export type GradeStudentSpeakingInput = z.infer<typeof gradeStudentSpeakingSchema>
export const GradeStudentSpeakingSchema = gradeStudentSpeakingSchema

export const submitSpeakingSubmissionSchema = z
  .object({
    topicId: z.string().min(1),
    studentId: z.string().min(1),
    audioUrl: z.string().default(''),
    fileId: z.string().optional(),
    durationSeconds: z.number().int().min(0).default(0),
    audioBase64: z.string().optional(),
    mimeType: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(
        (data.audioUrl && data.audioUrl.trim().length > 0) ||
        (data.audioBase64 && data.audioBase64.trim().length > 0) ||
        (data.fileId && data.fileId.trim().length > 0),
      ),
    {
      message: 'Either audioUrl, fileId or audioBase64 must be provided',
      path: ['audioUrl'],
    },
  )
export type SubmitSpeakingSubmissionInput = z.infer<typeof submitSpeakingSubmissionSchema>
export const SubmitSpeakingSubmissionSchema = submitSpeakingSubmissionSchema

const emptyToUndefined = (val: unknown) => (typeof val === 'string' && val.trim() === '' ? undefined : val)

export const querySpeakingSchema = z.object({
  groupId: z.preprocess(emptyToUndefined, z.string().optional()),
  topicId: z.preprocess(emptyToUndefined, z.string().optional()),
  studentId: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.preprocess(emptyToUndefined, speakingSubmissionStatusSchema.optional()),
})
export type QuerySpeaking = z.infer<typeof querySpeakingSchema>
export const QuerySpeakingSchema = querySpeakingSchema

export const speakingTopicListResponseSchema = z.object({
  data: z.array(speakingTopicSchema),
})
export const speakingTopicResponseSchema = z.object({
  data: speakingTopicSchema,
})
export const speakingSubmissionListResponseSchema = z.object({
  data: z.array(speakingSubmissionSchema),
})
export const speakingSubmissionResponseSchema = z.object({
  data: speakingSubmissionSchema,
})
