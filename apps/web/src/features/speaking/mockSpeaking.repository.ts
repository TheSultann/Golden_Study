import type {
  CreateSpeakingTopicInput,
  GradeSpeakingSubmissionInput,
  GradeStudentSpeakingInput,
  QuerySpeaking,
  SpeakingSubmission,
  SpeakingTopic,
  SubmitSpeakingSubmissionInput,
} from '@golden-study/contracts'

import type { SpeakingRepository } from './speaking.repository'

export const mockSpeakingTopics: SpeakingTopic[] = [
  {
    id: 'spk-top-1',
    groupId: 'g-1',
    groupName: 'IELTS Band 7.5',
    teacherId: 't-1',
    title: 'Describe a memorable journey you took',
    description: 'You should say where you went, whom you went with, and explain why it was memorable.',
    maxScore: 10,
    deadline: null,
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'spk-top-2',
    groupId: 'g-1',
    groupName: 'IELTS Band 7.5',
    teacherId: 't-1',
    title: 'Talk about a technology you cannot live without',
    description: 'Describe what it is, how often you use it, and how it impacts your daily efficiency.',
    maxScore: 10,
    deadline: null,
    createdAt: '2026-11-03T14:30:00.000Z',
  },
  {
    id: 'spk-top-3',
    groupId: 'g-2',
    groupName: 'General English B2',
    teacherId: 't-1',
    title: 'Speaking amaliyoti',
    description: 'O‘quvchilarning erkin nutq amaliyoti.',
    maxScore: 10,
    deadline: null,
    createdAt: '2026-11-04T10:00:00.000Z',
  },
]

export const mockSpeakingSubmissions: SpeakingSubmission[] = [
  {
    id: 'spk-sub-1',
    topicId: 'spk-top-1',
    studentId: 'st-1',
    studentName: 'Bobur Karimov',
    studentCode: 'SPK101',
    audioUrl: 'https://cdn.example.com/audio/sample_speaking.mp3',
    durationSeconds: 48,
    transcript:
      'Well, speaking about an unforgettable journey, I would love to recount my trip to Samarkand last autumn. The majestic architecture of Registan truly left an indelible mark on my memory.',
    aiFeedback:
      '## 📊 IELTS Speaking Tahlili (Band 7.0 / CEFR C1)\n\n### 🎯 Mezonlar\n- **Fluency & Coherence:** 7.0 — Fikrlar ravon va mantiqiy.\n- **Lexical Resource:** 7.5 — "indelible mark", "majestic architecture" kabi yuksak so‘zlar qo‘llanilgan.\n- **Grammatical Range & Accuracy:** 7.0 — Murakkab grammatik strukturalar to‘g‘ri ishlatilgan.\n- **Pronunciation:** 7.0 — Aniq va tabiiy urg‘u.',
    aiScore: 7.0,
    teacherScore: null,
    teacherComment: null,
    status: 'EVALUATED_BY_AI',
    createdAt: '2026-11-02T11:20:00.000Z',
  },
  {
    id: 'spk-sub-2',
    topicId: 'spk-top-1',
    studentId: 'st-2',
    studentName: 'Malika Rahimova',
    studentCode: 'SPK102',
    audioUrl: 'https://cdn.example.com/audio/sample_speaking_2.mp3',
    durationSeconds: 55,
    transcript:
      'I want to talk about my journey to the mountains with my family. We spent two days hiking and enjoying fresh air.',
    aiFeedback:
      '## 📊 IELTS Speaking Tahlili (Band 6.5 / CEFR B2)\n\n### 📝 Grammatika\nArtikllar va gap tuzilishi to‘g‘ri, lekin akademik sinonimlardan ko‘proq foydalanish tavsiya etiladi.',
    aiScore: 6.5,
    teacherScore: 7.0,
    teacherComment: 'Juda yaxshi intonatsiya va erkin gapirish. Keyingi safar C1 darajadagi iboralarni qo‘shing!',
    status: 'GRADED_BY_TEACHER',
    createdAt: '2026-11-02T15:40:00.000Z',
  },
  {
    id: 'spk-sub-3',
    topicId: 'spk-top-3',
    studentId: 'st-2',
    studentName: 'Dilnoza Aliyeva',
    studentCode: 'SPK201',
    audioUrl: 'https://cdn.example.com/audio/sample_speaking_3.mp3',
    durationSeconds: 40,
    transcript: 'Hello, I want to talk about my daily routine and English study plan.',
    aiFeedback: '## 📊 IELTS Speaking Tahlili (Band 7.0)\n\nAniq va tushunarli nutq.',
    aiScore: 7.0,
    teacherScore: 7.5,
    teacherComment: 'Juda yaxshi natija!',
    status: 'GRADED_BY_TEACHER',
    createdAt: '2026-11-04T11:00:00.000Z',
  },
]

export class MockSpeakingRepository implements SpeakingRepository {
  private topics: SpeakingTopic[] = [...mockSpeakingTopics]
  private submissions: SpeakingSubmission[] = [...mockSpeakingSubmissions]

  async listTopics(groupId?: string): Promise<SpeakingTopic[]> {
    if (!groupId) return [...this.topics]
    const filtered = this.topics.filter((t) => t.groupId === groupId)
    if (filtered.length === 0) {
      const defaultTopic: SpeakingTopic = {
        id: `spk-default-${groupId}`,
        groupId,
        groupName: 'Guruh',
        teacherId: 'teacher-mock',
        title: 'Speaking amaliyoti',
        description: 'O‘quvchilarning og‘zaki nutq amaliyoti va ovozli topshiriqlari',
        maxScore: 10,
        deadline: null,
        createdAt: new Date().toISOString(),
      }
      this.topics.push(defaultTopic)
      return [defaultTopic]
    }
    return filtered
  }

  async createTopic(input: CreateSpeakingTopicInput): Promise<SpeakingTopic> {
    const newTopic: SpeakingTopic = {
      id: `spk-top-${Date.now()}`,
      groupId: input.groupId,
      groupName: 'IELTS Group',
      teacherId: 'teacher-mock',
      title: input.title,
      description: input.description ?? '',
      maxScore: input.maxScore ?? 10,
      deadline: input.deadline ?? null,
      createdAt: new Date().toISOString(),
    }
    this.topics.unshift(newTopic)
    return newTopic
  }

  async listSubmissions(query?: QuerySpeaking): Promise<SpeakingSubmission[]> {
    return this.submissions.filter((sub) => {
      if (query?.topicId && sub.topicId !== query.topicId) return false
      if (query?.studentId && sub.studentId !== query.studentId) return false
      if (query?.status && sub.status !== query.status) return false
      if (query?.groupId) {
        const topic = this.topics.find((t) => t.id === sub.topicId)
        if (topic) {
          if (topic.groupId !== query.groupId) return false
        } else {
          if (sub.topicId !== `spk-default-${query.groupId}` && sub.topicId !== query.groupId) {
            return false
          }
        }
      }
      return true
    })
  }

  async gradeSubmission(
    id: string,
    input: GradeSpeakingSubmissionInput,
  ): Promise<SpeakingSubmission> {
    const index = this.submissions.findIndex((s) => s.id === id)
    if (index === -1) {
      throw new Error(`Submission with id ${id} not found`)
    }

    const updated: SpeakingSubmission = {
      ...this.submissions[index]!,
      teacherScore: input.teacherScore,
      teacherComment: input.teacherComment ?? '',
      status: 'GRADED_BY_TEACHER',
    }
    this.submissions[index] = updated
    return updated
  }

  async gradeStudent(
    input: GradeStudentSpeakingInput,
  ): Promise<SpeakingSubmission> {
    const existingIndex = this.submissions.findIndex(
      (s) => s.studentId === input.studentId && (!input.topicId || s.topicId === input.topicId),
    )

    if (existingIndex !== -1) {
      const updated: SpeakingSubmission = {
        ...this.submissions[existingIndex]!,
        teacherScore: input.teacherScore,
        teacherComment: input.teacherComment ?? '',
        status: 'GRADED_BY_TEACHER',
      }
      this.submissions[existingIndex] = updated
      return updated
    }

    const newSub: SpeakingSubmission = {
      id: `spk-inperson-${Date.now()}`,
      topicId: input.topicId || 'default-topic',
      studentId: input.studentId,
      studentName: 'O‘quvchi',
      studentCode: 'ST101',
      audioUrl: 'in-person',
      durationSeconds: 0,
      transcript: '',
      aiFeedback: '',
      aiScore: null,
      teacherScore: input.teacherScore,
      teacherComment: input.teacherComment ?? '',
      status: 'GRADED_BY_TEACHER',
      createdAt: new Date().toISOString(),
    }
    this.submissions.unshift(newSub)
    return newSub
  }

  async submitRecording(
    input: SubmitSpeakingSubmissionInput,
  ): Promise<SpeakingSubmission> {
    const newSubmission: SpeakingSubmission = {
      id: `spk-sub-${Date.now()}`,
      topicId: input.topicId,
      studentId: input.studentId,
      studentName: 'O‘quvchi',
      studentCode: 'SPK999',
      audioUrl: input.audioUrl,
      durationSeconds: input.durationSeconds ?? 45,
      transcript:
        'Well, this is an automated transcript simulation generated by the mock repository for offline and test environments.',
      aiFeedback:
        '## 📊 IELTS Speaking Tahlili (Band 7.0)\n\nMock evaluation feedback for IELTS speaking assessment.',
      aiScore: 7.0,
      teacherScore: null,
      teacherComment: null,
      status: 'EVALUATED_BY_AI',
      createdAt: new Date().toISOString(),
    }
    this.submissions.unshift(newSubmission)
    return newSubmission
  }
}
