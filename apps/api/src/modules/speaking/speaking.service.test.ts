import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import type { GeminiSpeakingService } from './gemini-speaking.service.js';
import { SpeakingService } from './speaking.service.js';

describe('SpeakingService AI Evaluation & Idempotency', () => {
  it('does not re-evaluate a submission that is already EVALUATED_BY_AI (idempotency)', async () => {
    const findUniqueMock = vi.fn().mockResolvedValue({
      id: 'sub-1',
      topicId: 'topic-1',
      studentId: 'student-1',
      audioUrl: 'https://example.com/audio.ogg',
      durationSeconds: 30,
      transcript: 'Existing transcript',
      aiFeedback: 'Existing feedback',
      aiScore: 7.5,
      teacherScore: null,
      teacherComment: null,
      status: 'EVALUATED_BY_AI',
      createdAt: new Date('2026-11-01'),
      topic: { title: 'Topic', description: 'Desc' },
      student: { firstName: 'Ali', lastName: 'Valiyev', studentCode: 'SPK01' },
    });
    const updateMock = vi.fn();
    const evaluateMock = vi.fn();

    const mockPrisma = {
      speakingSubmission: {
        findUnique: findUniqueMock,
        update: updateMock,
      },
    };
    const mockGeminiService = {
      evaluate: evaluateMock,
    };

    const service = new SpeakingService(
      mockPrisma as unknown as PrismaClient,
      mockGeminiService as unknown as GeminiSpeakingService,
    );

    const result = await service.evaluateSubmission('sub-1');

    expect(result.status).toBe('EVALUATED_BY_AI');
    expect(result.transcript).toBe('Existing transcript');
    expect(result.aiScore).toBe(7.5);
    expect(evaluateMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('does not re-evaluate a submission that is already GRADED_BY_TEACHER', async () => {
    const findUniqueMock = vi.fn().mockResolvedValue({
      id: 'sub-2',
      topicId: 'topic-1',
      studentId: 'student-1',
      audioUrl: 'https://example.com/audio.ogg',
      durationSeconds: 30,
      transcript: 'Transcript',
      aiFeedback: 'Feedback',
      aiScore: 7.0,
      teacherScore: 8.0,
      teacherComment: 'Teacher remarks',
      status: 'GRADED_BY_TEACHER',
      createdAt: new Date('2026-11-01'),
      topic: { title: 'Topic', description: 'Desc' },
      student: { firstName: 'Ali', lastName: 'Valiyev', studentCode: 'SPK01' },
    });
    const evaluateMock = vi.fn();

    const mockPrisma = {
      speakingSubmission: {
        findUnique: findUniqueMock,
        update: vi.fn(),
      },
    };
    const mockGeminiService = {
      evaluate: evaluateMock,
    };

    const service = new SpeakingService(
      mockPrisma as unknown as PrismaClient,
      mockGeminiService as unknown as GeminiSpeakingService,
    );

    const result = await service.evaluateSubmission('sub-2');

    expect(result.status).toBe('GRADED_BY_TEACHER');
    expect(result.teacherScore).toBe(8.0);
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it('evaluates a PENDING_AI submission and updates database', async () => {
    const findUniqueMock = vi.fn().mockResolvedValue({
      id: 'sub-3',
      topicId: 'topic-1',
      studentId: 'student-1',
      audioUrl: 'https://example.com/audio.ogg',
      durationSeconds: 20,
      transcript: '',
      aiFeedback: '',
      aiScore: null,
      teacherScore: null,
      teacherComment: null,
      status: 'PENDING_AI',
      createdAt: new Date('2026-11-01'),
      topic: { title: 'Topic', description: 'Desc' },
      student: { firstName: 'Ali', lastName: 'Valiyev', studentCode: 'SPK01' },
    });

    const updateMock = vi.fn().mockResolvedValue({
      id: 'sub-3',
      topicId: 'topic-1',
      studentId: 'student-1',
      audioUrl: 'https://example.com/audio.ogg',
      durationSeconds: 20,
      transcript: 'New transcript',
      aiFeedback: 'New feedback',
      aiScore: 6.5,
      teacherScore: null,
      teacherComment: null,
      status: 'EVALUATED_BY_AI',
      createdAt: new Date('2026-11-01'),
      student: { firstName: 'Ali', lastName: 'Valiyev', studentCode: 'SPK01' },
    });

    const evaluateMock = vi.fn().mockResolvedValue({
      transcript: 'New transcript',
      aiScore: 6.5,
      aiFeedback: 'New feedback',
      modelUsed: 'gemini-3.8-flash',
    });

    const mockPrisma = {
      speakingSubmission: {
        findUnique: findUniqueMock,
        update: updateMock,
      },
    };
    const mockGeminiService = {
      evaluate: evaluateMock,
    };

    const service = new SpeakingService(
      mockPrisma as unknown as PrismaClient,
      mockGeminiService as unknown as GeminiSpeakingService,
    );

    const result = await service.evaluateSubmission('sub-3');

    expect(evaluateMock).toHaveBeenCalledWith({
      audioUrl: 'https://example.com/audio.ogg',
      topicTitle: 'Topic',
      topicDescription: 'Desc',
    });
    expect(updateMock).toHaveBeenCalled();
    expect(result.status).toBe('EVALUATED_BY_AI');
    expect(result.transcript).toBe('New transcript');
    expect(result.aiScore).toBe(6.5);
  });
});
