import { beforeEach, describe, expect, it } from 'vitest'

import { MockSpeakingRepository } from './mockSpeaking.repository'

describe('MockSpeakingRepository', () => {
  let repository: MockSpeakingRepository

  beforeEach(() => {
    repository = new MockSpeakingRepository()
  })

  it('lists initial speaking topics and filters by groupId', async () => {
    const allTopics = await repository.listTopics()
    expect(allTopics.length).toBeGreaterThanOrEqual(2)

    const groupTopics = await repository.listTopics('g-1')
    expect(groupTopics.every((t) => t.groupId === 'g-1')).toBe(true)

    const emptyGroupTopics = await repository.listTopics('non-existent')
    expect(emptyGroupTopics).toHaveLength(1)
    expect(emptyGroupTopics[0]?.title).toBe('Speaking amaliyoti')
    expect(emptyGroupTopics[0]?.maxScore).toBe(10)
  })

  it('creates a new speaking topic', async () => {
    const topic = await repository.createTopic({
      groupId: 'g-2',
      title: 'Describe your hometown',
      description: 'Detail its geography and climate.',
      maxScore: 10,
      deadline: null,
    })

    expect(topic.id).toBeDefined()
    expect(topic.title).toBe('Describe your hometown')
    expect(topic.groupId).toBe('g-2')

    const topics = await repository.listTopics('g-2')
    expect(topics.some((t) => t.id === topic.id)).toBe(true)
  })

  it('filters submissions by topicId, groupId and status', async () => {
    const subs = await repository.listSubmissions({ topicId: 'spk-top-1' })
    expect(subs.length).toBeGreaterThanOrEqual(1)

    const groupSubs = await repository.listSubmissions({ groupId: 'g-1' })
    expect(groupSubs.length).toBeGreaterThanOrEqual(1)

    const emptyGroupSubs = await repository.listSubmissions({ groupId: 'non-existent' })
    expect(emptyGroupSubs).toHaveLength(0)

    const graded = await repository.listSubmissions({ status: 'GRADED_BY_TEACHER' })
    expect(graded.every((s) => s.status === 'GRADED_BY_TEACHER')).toBe(true)
  })

  it('grades a speaking submission and updates status', async () => {
    const updated = await repository.gradeSubmission('spk-sub-1', {
      teacherScore: 8.0,
      teacherComment: 'Outstanding lexical resource and coherence.',
    })

    expect(updated.id).toBe('spk-sub-1')
    expect(updated.teacherScore).toBe(8.0)
    expect(updated.teacherComment).toBe('Outstanding lexical resource and coherence.')
    expect(updated.status).toBe('GRADED_BY_TEACHER')
  })

  it('submits a voice recording and returns evaluated submission', async () => {
    const sub = await repository.submitRecording({
      topicId: 'spk-top-1',
      studentId: 'st-99',
      audioUrl: 'https://cdn.example.com/audio/test.ogg',
      durationSeconds: 30,
    })

    expect(sub.id).toBeDefined()
    expect(sub.topicId).toBe('spk-top-1')
    expect(sub.studentId).toBe('st-99')
    expect(sub.status).toBe('EVALUATED_BY_AI')
    expect(sub.transcript.length).toBeGreaterThan(10)
  })
})
