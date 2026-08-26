import { z } from 'zod'

export const examResultSchema = z.object({
  studentId: z.string(),
  studentCode: z.string(),
  studentName: z.string(),
  score: z.number().int().min(0),
  comment: z.string(),
  rank: z.number().int().positive(),
})

export const examSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  groupName: z.string(),
  name: z.string().min(1),
  date: z.string(),
  maxScore: z.number().int().positive(),
  results: z.array(examResultSchema),
})

export const examListResponseSchema = z.object({ data: z.array(examSchema) })
export const examResponseSchema = z.object({ data: examSchema })

export const examResultInputSchema = z.object({
  studentId: z.string().min(1),
  score: z.number().int().min(0),
  comment: z.string().max(500).default(''),
  rank: z.number().int().positive(),
})

export const examSaveInputSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maxScore: z.number().int().positive(),
  results: z.array(examResultInputSchema).default([]),
})

export type Exam = z.infer<typeof examSchema>
export type ExamResult = z.infer<typeof examResultSchema>
export type ExamSaveInput = z.infer<typeof examSaveInputSchema>
