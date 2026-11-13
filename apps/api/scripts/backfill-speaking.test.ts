import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { GeminiSpeakingService } from '../src/modules/speaking/gemini-speaking.service.js';
import { backfillSpeakingSubmissions } from './backfill-speaking.js';

describe('backfillSpeakingSubmissions', () => {
  it('returns early when all telegram submissions already have transcripts', async () => {
    const mockPrisma = {
      speakingSubmission: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'sub-1',
            audioUrl: 'telegram:file123',
            transcript: 'Already transcribed speech',
            aiFeedback: 'Feedback',
            aiScore: 7.0,
            status: 'EVALUATED_BY_AI',
            topic: { id: 'top-1', title: 'Topic 1', description: 'Desc 1' },
            student: { id: 'st-1', firstName: 'Munisa', lastName: 'Baxtiyorova', studentCode: 'ST105' },
          },
        ]),
      },
    };
    const mockGemini = {
      evaluate: vi.fn(),
    };

    const logs: string[] = [];
    const result = await backfillSpeakingSubmissions(
      mockPrisma as unknown as PrismaClient,
      mockGemini as unknown as GeminiSpeakingService,
      (msg) => logs.push(msg),
    );

    expect(result.total).toBe(1);
    expect(result.processed).toBe(0);
    expect(result.success).toBe(0);
    expect(mockGemini.evaluate).not.toHaveBeenCalled();
  });

  it('backfills submissions with missing transcripts and handles PENDING_AI vs GRADED_BY_TEACHER', async () => {
    const mockPrisma = {
      speakingSubmission: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'sub-pending',
            audioUrl: 'telegram:file_pending',
            transcript: '',
            aiFeedback: '',
            aiScore: null,
            status: 'PENDING_AI',
            topic: { id: 'top-1', title: 'Topic 1', description: 'Desc 1' },
            student: { id: 'st-1', firstName: 'Munisa', lastName: 'Baxtiyorova', studentCode: 'ST105' },
          },
          {
            id: 'sub-graded',
            audioUrl: 'telegram:file_graded',
            transcript: '   ', // whitespace only
            aiFeedback: '',
            aiScore: null,
            status: 'GRADED_BY_TEACHER',
            teacherScore: 8.5,
            topic: { id: 'top-2', title: 'Topic 2', description: null },
            student: { id: 'st-2', firstName: 'Shahzoda', lastName: 'Kushmetova', studentCode: 'ST114' },
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const mockGemini = {
      evaluate: vi.fn().mockImplementation(async (input: { audioUrl: string }) => {
        if (input.audioUrl === 'telegram:file_pending') {
          return {
            transcript: 'Transcribed speech for Munisa',
            aiScore: 7.5,
            aiFeedback: 'Great pronunciation',
            modelUsed: 'gemini-3.6-flash',
          };
        }
        return {
          transcript: 'Transcribed speech for Shahzoda',
          aiScore: 8.0,
          aiFeedback: 'Clear delivery',
          modelUsed: 'gemini-3.6-flash',
        };
      }),
    };

    const logs: string[] = [];
    const result = await backfillSpeakingSubmissions(
      mockPrisma as unknown as PrismaClient,
      mockGemini as unknown as GeminiSpeakingService,
      (msg) => logs.push(msg),
    );

    expect(result.total).toBe(2);
    expect(result.processed).toBe(2);
    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);

    // Verify sub-pending updated to EVALUATED_BY_AI
    expect(mockPrisma.speakingSubmission.update).toHaveBeenCalledWith({
      where: { id: 'sub-pending' },
      data: {
        transcript: 'Transcribed speech for Munisa',
        aiFeedback: 'Great pronunciation',
        aiScore: 7.5,
        status: 'EVALUATED_BY_AI',
      },
    });

    // Verify sub-graded KEPT status GRADED_BY_TEACHER
    expect(mockPrisma.speakingSubmission.update).toHaveBeenCalledWith({
      where: { id: 'sub-graded' },
      data: {
        transcript: 'Transcribed speech for Shahzoda',
        aiFeedback: 'Clear delivery',
        aiScore: 8.0,
        status: 'GRADED_BY_TEACHER',
      },
    });
  });

  it('continues and tallies failures when evaluation returns null or throws', async () => {
    const mockPrisma = {
      speakingSubmission: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'sub-fail-null',
            audioUrl: 'telegram:file_bad_audio',
            transcript: '',
            status: 'PENDING_AI',
            topic: { title: 'Topic' },
            student: { firstName: 'Test', lastName: 'User', studentCode: 'ST999' },
          },
          {
            id: 'sub-success',
            audioUrl: 'telegram:file_good',
            transcript: '',
            status: 'PENDING_AI',
            topic: { title: 'Topic' },
            student: { firstName: 'Good', lastName: 'User', studentCode: 'ST998' },
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const mockGemini = {
      evaluate: vi.fn().mockImplementation(async (input: { audioUrl: string }) => {
        if (input.audioUrl === 'telegram:file_bad_audio') {
          return null; // All models failed or audio unavailable
        }
        return {
          transcript: 'Good transcript',
          aiScore: 7.0,
          aiFeedback: 'Good feedback',
          modelUsed: 'gemini-3.6-flash',
        };
      }),
    };

    const logs: string[] = [];
    const result = await backfillSpeakingSubmissions(
      mockPrisma as unknown as PrismaClient,
      mockGemini as unknown as GeminiSpeakingService,
      (msg) => logs.push(msg),
    );

    expect(result.processed).toBe(2);
    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(mockPrisma.speakingSubmission.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.speakingSubmission.update).toHaveBeenCalledWith({
      where: { id: 'sub-success' },
      data: {
        transcript: 'Good transcript',
        aiFeedback: 'Good feedback',
        aiScore: 7.0,
        status: 'EVALUATED_BY_AI',
      },
    });
  });
});
