import { PrismaClient } from '@prisma/client';
import { GeminiSpeakingService } from '../src/modules/speaking/gemini-speaking.service.js';

export interface BackfillSpeakingResult {
  total: number;
  processed: number;
  success: number;
  failed: number;
}

export async function backfillSpeakingSubmissions(
  prisma: PrismaClient,
  geminiService: GeminiSpeakingService,
  log: (msg: string) => void = console.log,
): Promise<BackfillSpeakingResult> {
  log('[backfill-speaking] Searching for speaking submissions with Telegram audio and missing transcript...');

  const submissions = await prisma.speakingSubmission.findMany({
    where: {
      audioUrl: { startsWith: 'telegram:' },
    },
    include: {
      topic: { select: { id: true, title: true, description: true } },
      student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const pending = submissions.filter(
    (s) => !s.transcript || s.transcript.trim() === '',
  );

  log(`[backfill-speaking] Found ${pending.length} submissions needing AI transcript/feedback (out of ${submissions.length} total Telegram submissions).`);

  if (pending.length === 0) {
    log('[backfill-speaking] All Telegram speaking submissions already have transcripts. Nothing to do.');
    return {
      total: submissions.length,
      processed: 0,
      success: 0,
      failed: 0,
    };
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    const sub = pending[i]!;
    const studentLabel = `${sub.student.studentCode} (${sub.student.firstName} ${sub.student.lastName})`;
    log(`[${i + 1}/${pending.length}] Processing submission ${sub.id} for student ${studentLabel}...`);

    try {
      const evaluation = await geminiService.evaluate({
        audioUrl: sub.audioUrl,
        topicTitle: sub.topic?.title || 'Speaking Topic',
        topicDescription: sub.topic?.description || undefined,
      });

      if (!evaluation) {
        log(`  ⚠️ Evaluation returned null for submission ${sub.id}. Audio may be unavailable or all models failed.`);
        failed++;
        continue;
      }

      // If status is PENDING_AI, move to EVALUATED_BY_AI.
      // If already GRADED_BY_TEACHER, keep GRADED_BY_TEACHER so teacher scores are preserved.
      const nextStatus = sub.status === 'PENDING_AI' ? 'EVALUATED_BY_AI' : sub.status;

      await prisma.speakingSubmission.update({
        where: { id: sub.id },
        data: {
          transcript: evaluation.transcript,
          aiFeedback: evaluation.aiFeedback,
          aiScore: evaluation.aiScore,
          status: nextStatus,
        },
      });

      log(`  ✅ Updated ${sub.id}: model=${evaluation.modelUsed || 'unknown'}, aiScore=${evaluation.aiScore}, status=${sub.status} -> ${nextStatus}`);
      log(`     Transcript snippet: "${evaluation.transcript.slice(0, 100).replace(/\n/g, ' ')}..."`);
      success++;
    } catch (err) {
      log(`  ❌ Failed processing ${sub.id}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  log(`[backfill-speaking] Completed. Total: ${pending.length}, Succeeded: ${success}, Failed: ${failed}.`);

  return {
    total: submissions.length,
    processed: pending.length,
    success,
    failed,
  };
}

async function main() {
  const prisma = new PrismaClient();
  const geminiService = new GeminiSpeakingService();

  try {
    const result = await backfillSpeakingSubmissions(prisma, geminiService, console.log);
    console.log('[backfill-speaking] Result:', result);
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-run if executed directly via tsx/node
const isDirectExecution =
  process.argv[1]?.endsWith('backfill-speaking.ts') ||
  process.argv[1]?.endsWith('backfill-speaking.js');

if (isDirectExecution) {
  main().catch((err) => {
    console.error('[backfill-speaking] Fatal error:', err);
    process.exit(1);
  });
}
