import { describe, expect, it, vi } from 'vitest'
import { ApiSpeakingRepository } from './apiSpeaking.repository'

const mockTopic = {
  id: 'topic-1',
  groupId: 'group-1',
  groupName: 'IELTS Prep',
  teacherId: 'teacher-1',
  title: 'Hometown Description',
  description: 'Describe your hometown in detail',
  maxScore: 9,
  deadline: '2026-12-01',
  createdAt: '2026-11-01T00:00:00.000Z',
}

const mockSubmission = {
  id: 'sub-1',
  topicId: 'topic-1',
  studentId: 'stud-1',
  studentName: 'Ali Valiyev',
  studentCode: 'SPK001',
  audioUrl: 'https://cdn.example.com/audio.mp3',
  durationSeconds: 60,
  transcript: 'My hometown is Bukhara...',
  aiFeedback: 'Great fluency',
  aiScore: 7.0,
  teacherScore: 7.5,
  teacherComment: 'Very nice pronunciation',
  status: 'GRADED_BY_TEACHER' as const,
  createdAt: '2026-11-02T00:00:00.000Z',
}

vi.mock('../../shared/api/httpClient', () => ({
  apiRequest: vi.fn().mockImplementation((path: string, options?: { method?: string }) => {
    if (path.includes('/speaking/topics')) {
      if (options?.method === 'POST') {
        return Promise.resolve({ data: mockTopic })
      }
      return Promise.resolve({ data: [mockTopic] })
    }
    if (path.includes('/speaking/submissions')) {
      if (options?.method === 'POST') {
        return Promise.resolve({ data: mockSubmission })
      }
      return Promise.resolve({ data: [mockSubmission] })
    }
    return Promise.resolve({ data: null })
  }),
}))

describe('ApiSpeakingRepository', () => {
  it('lists topics and validates response schema', async () => {
    const repo = new ApiSpeakingRepository()
    const topics = await repo.listTopics('group-1')
    expect(topics).toHaveLength(1)
    expect(topics[0]?.title).toBe('Hometown Description')
  })

  it('creates topic and validates response schema', async () => {
    const repo = new ApiSpeakingRepository()
    const topic = await repo.createTopic({
      groupId: 'group-1',
      title: 'Hometown Description',
      description: 'Describe your hometown in detail',
      maxScore: 9,
      deadline: '2026-12-01',
    })
    expect(topic.id).toBe('topic-1')
  })

  it('lists submissions and validates response schema', async () => {
    const repo = new ApiSpeakingRepository()
    const subs = await repo.listSubmissions({ topicId: 'topic-1' })
    expect(subs).toHaveLength(1)
    expect(subs[0]?.studentName).toBe('Ali Valiyev')
  })

  it('grades submission and validates response schema', async () => {
    const repo = new ApiSpeakingRepository()
    const graded = await repo.gradeSubmission('sub-1', {
      teacherScore: 7.5,
      teacherComment: 'Very nice pronunciation',
    })
    expect(graded.teacherScore).toBe(7.5)
    expect(graded.status).toBe('GRADED_BY_TEACHER')
  })

  it('submits recording and validates response schema', async () => {
    const repo = new ApiSpeakingRepository()
    const res = await repo.submitRecording({
      topicId: 'topic-1',
      studentId: 'stud-1',
      audioUrl: 'https://cdn.example.com/audio.mp3',
      durationSeconds: 60,
    })
    expect(res.id).toBe('sub-1')
  })
})
