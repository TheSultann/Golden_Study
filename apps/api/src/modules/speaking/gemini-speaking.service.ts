import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ModelCircuitBreaker } from './circuit-breaker.js';
import type {
  CircuitBreakerConfig,
  ModelCircuitBreakerStats,
} from './circuit-breaker.types.js';
import {
  classifyGeminiError,
  classifyGeminiException,
} from './gemini-error-classifier.js';

export interface EvaluateAudioInput {
  audioUrl: string;
  audioBase64?: string | undefined;
  mimeType?: string | undefined;
  topicTitle: string;
  topicDescription?: string | undefined;
}

export interface GeminiSpeakingEvaluationResult {
  transcript: string;
  aiScore: number;
  aiFeedback: string;
  modelUsed?: string | undefined;
}

export interface GeminiSpeakingServiceOptions {
  models?: string[] | undefined;
  circuitBreakerConfig?: CircuitBreakerConfig | undefined;
  timeoutMs?: number | undefined; // Overall timeout budget for evaluate() call
  perModelTimeoutMs?: number | undefined; // Timeout budget for individual model attempts
}

/**
 * Verified production chain:
 * 1. gemini-3.8-flash (primary)
 * 2. gemini-3.6-flash (first fallback)
 * Note on gemma-4-31b-it: Excluded from audio evaluation production chain because
 * Google Generative AI API explicitly rejects audio input modality with HTTP 400
 * ("Audio input modality is not enabled for this model").
 */
export const DEFAULT_SPEAKING_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-transcribe',
  'whisper-large-v3',
] as const;

export class GeminiSpeakingService {
  private readonly apiKey?: string | undefined;
  private readonly models: readonly string[];
  private readonly circuitBreakers: Map<string, ModelCircuitBreaker> = new Map();
  private readonly timeoutMs: number;
  private readonly perModelTimeoutMs: number;

  public constructor(
    apiKey?: string | undefined,
    options?: GeminiSpeakingServiceOptions,
  ) {
    this.apiKey = arguments.length > 0 ? apiKey : env.GEMINI_API_KEY;
    this.models = options?.models && options.models.length > 0
      ? options.models
      : DEFAULT_SPEAKING_MODELS;
    this.timeoutMs = options?.timeoutMs ?? 25_000;
    this.perModelTimeoutMs = options?.perModelTimeoutMs ?? Math.min(10_000, this.timeoutMs);

    for (const model of this.models) {
      this.circuitBreakers.set(
        model,
        new ModelCircuitBreaker(model, options?.circuitBreakerConfig),
      );
    }
  }

  public get candidateModels(): readonly string[] {
    return this.models;
  }

  public getCircuitBreaker(model: string): ModelCircuitBreaker | undefined {
    return this.circuitBreakers.get(model);
  }

  public getCircuitBreakerStats(): Record<string, ModelCircuitBreakerStats> {
    const result: Record<string, ModelCircuitBreakerStats> = {};
    for (const [model, cb] of this.circuitBreakers) {
      result[model] = cb.getStats();
    }
    return result;
  }

  public resetCircuitBreakers(): void {
    for (const cb of this.circuitBreakers.values()) {
      cb.reset();
    }
  }

  public async evaluate(input: EvaluateAudioInput): Promise<GeminiSpeakingEvaluationResult | null> {
    if (!this.apiKey) {
      logger.info('GeminiSpeakingService: GEMINI_API_KEY not configured, skipping AI evaluation for manual review');
      return null;
    }

    const overallDeadline = Date.now() + this.timeoutMs;

    try {
      let audioBase64 = input.audioBase64;
      let mimeType = input.mimeType || 'audio/ogg';
      if (mimeType.includes(';')) {
        mimeType = mimeType.split(';')[0]!.trim();
      }

      // Fetch audio ONCE before failover loop — never re-download audio on fallback
      if (!audioBase64 && input.audioUrl.startsWith('http')) {
        const remainingForAudio = overallDeadline - Date.now();
        if (remainingForAudio <= 0) {
          logger.warn('GeminiSpeakingService: Overall timeout budget depleted before audio fetch');
          return null;
        }
        try {
          const fetched = await fetch(input.audioUrl, {
            signal: AbortSignal.timeout(Math.min(15000, remainingForAudio)),
          });
          if (fetched.ok) {
            const arrayBuffer = await fetched.arrayBuffer();
            audioBase64 = Buffer.from(arrayBuffer).toString('base64');
            const contentType = fetched.headers.get('content-type');
            if (contentType) {
              mimeType = contentType.includes(';')
                ? contentType.split(';')[0]!.trim()
                : contentType.trim();
            }
          }
        } catch {
          // Handled below if audioBase64 is missing
        }
      } else if (
        !audioBase64 &&
        (input.audioUrl.startsWith('telegram:') ||
          (!input.audioUrl.startsWith('http') && !input.audioUrl.startsWith('data:')))
      ) {
        const remainingForAudio = overallDeadline - Date.now();
        if (remainingForAudio <= 0) {
          logger.warn('GeminiSpeakingService: Overall timeout budget depleted before Telegram audio fetch');
          return null;
        }
        try {
          const fileId = input.audioUrl.startsWith('telegram:')
            ? input.audioUrl.slice(9).trim()
            : input.audioUrl.trim();
          if (fileId && env.TELEGRAM_BOT_TOKEN) {
            const getFileRes = await fetch(
              `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
              { signal: AbortSignal.timeout(Math.min(10000, remainingForAudio)) },
            );
            if (getFileRes.ok) {
              const fileInfo = (await getFileRes.json()) as {
                ok: boolean;
                result?: { file_path?: string };
              };
              if (fileInfo.ok && fileInfo.result?.file_path) {
                const fetched = await fetch(
                  `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`,
                  { signal: AbortSignal.timeout(Math.min(15000, remainingForAudio)) },
                );
                if (fetched.ok) {
                  const arrayBuffer = await fetched.arrayBuffer();
                  audioBase64 = Buffer.from(arrayBuffer).toString('base64');
                  mimeType = 'audio/ogg';
                }
              }
            }
          }
        } catch {
          // Handled below if audioBase64 is missing
        }
      }

      if (!audioBase64) {
        logger.warn(
          { audioUrl: input.audioUrl },
          'GeminiSpeakingService: Audio data could not be retrieved, skipping AI evaluation for manual review',
        );
        return null;
      }

      const promptText = `You are a concise, friendly English speaking coach.
Analyze this student's short spoken English audio.
Topic: "${input.topicTitle}"

Your goals:
1. Transcribe the student's exact spoken response verbatim, capturing real spoken English (including their errors and repetitions).
2. Provide a grammatically corrected, natural spoken English version of what the student meant to say. Format the corrected sentence as a quote using > "...".
3. Highlight mistakes clearly and simply with emojis in Uzbek (O'zbek tilida).
   Show each mistake and correction clearly, for example:
   • ❌ original_word ➔ ✅ corrected_word — qisqa tushuntirish
4. Assign an estimated score between 1.0 and 9.0 (e.g. 6.0) for internal teacher reference.

STRICT RULES:
- Do NOT output long IELTS criteria breakdowns (no Fluency, Lexical Resource, Pronunciation paragraphs).
- Do NOT write long essays or complex C1 vocabulary lists.
- Keep it clean, concise, modern, and easy for a student to read on Telegram.

Format your output strictly as a JSON object matching this schema:
{
  "transcript": "Verbatim transcript of student speech",
  "aiScore": 6.5,
  "aiFeedback": "✨ **To'g'rilangan variant:**\\n> \\\"Grammatically corrected natural speech in English\\\"\\n\\n🔍 **Xatolar va tuzatishlar:**\\n• ❌ *xato* ➔ ✅ **to'g'rilangan** — qisqa tushuntirish"
}`;

      const contentsParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
        { text: promptText },
      ];

      // Multi-Model Failover with Independent Circuit Breakers
      for (let i = 0; i < this.models.length; i++) {
        const remainingOverallMs = overallDeadline - Date.now();
        if (remainingOverallMs <= 0) {
          logger.warn(
            { remainingOverallMs },
            'GeminiSpeakingService: Overall request timeout budget depleted, aborting model chain',
          );
          break;
        }

        const model = this.models[i]!;
        let cb = this.circuitBreakers.get(model);
        if (!cb) {
          cb = new ModelCircuitBreaker(model);
          this.circuitBreakers.set(model, cb);
        }

        const canExecuteResult = cb.canExecute();
        if (!canExecuteResult.allowed) {
          logger.info(
            { model, reason: canExecuteResult.reason },
            'GeminiSpeakingService: Model circuit breaker active, skipping model',
          );
          continue;
        }

        let probeCompleted = false;
        const startTime = Date.now();
        try {
          const attemptTimeoutMs = Math.min(this.perModelTimeoutMs, remainingOverallMs);
          const isWhisper = model.includes('whisper');
          const isTranscribeOnly = model.includes('transcribe');
          const groqKey = env.GROQ_API_KEY;

          if (isWhisper && !groqKey) {
            logger.info({ model }, 'GeminiSpeakingService: GROQ_API_KEY not configured, skipping Whisper');
            continue;
          }

          let response: Response;
          if (isWhisper) {
            const audioBuffer = Buffer.from(audioBase64, 'base64');
            const blob = new Blob([audioBuffer], { type: mimeType || 'audio/ogg' });
            const formData = new FormData();
            const ext = mimeType?.includes('wav')
              ? 'audio.wav'
              : mimeType?.includes('mp3')
              ? 'audio.mp3'
              : 'audio.ogg';
            formData.append('file', blob, ext);
            formData.append('model', 'whisper-large-v3');
            formData.append('response_format', 'json');

            response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${groqKey}`,
              },
              signal: AbortSignal.timeout(attemptTimeoutMs),
              body: formData,
            });
          } else {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
            const requestBody: Record<string, unknown> = {
              contents: [{
                parts: isTranscribeOnly
                  ? [
                      contentsParts[0]!, // audio inlineData
                      { text: 'Transcribe this audio verbatim in English.' },
                    ]
                  : contentsParts,
              }],
            };

            if (!isTranscribeOnly) {
              requestBody.generationConfig = {
                temperature: 0.2,
                responseMimeType: 'application/json',
              };
            }

            response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.apiKey,
              },
              signal: AbortSignal.timeout(attemptTimeoutMs),
              body: JSON.stringify(requestBody),
            });
          }

          if (!response.ok) {
            const errText = await response.text();
            const errorInfo = classifyGeminiError(response.status, response.headers, errText);

            // Client errors (400, 401, 403): do NOT failover, do NOT trip circuit breaker
            if (!errorInfo.isRetriable) {
              // If model doesn't support audio or not found, fail over to next model in chain
              if (
                errorInfo.errorType === 'AUDIO_MODALITY_NOT_SUPPORTED' ||
                errorInfo.errorType === 'MODEL_NOT_FOUND'
              ) {
                cb.recordFailure(errorInfo, canExecuteResult.isProbe);
                cb.recordFallback();
                probeCompleted = true;
                logger.warn(
                  {
                    failedModel: model,
                    nextModel: this.models[i + 1] ?? null,
                    errorType: errorInfo.errorType,
                  },
                  'GeminiSpeakingService: Model does not support audio modality or not found, failing over',
                );
                continue;
              }

              cb.recordNonRetriable(errorInfo, canExecuteResult.isProbe);
              probeCompleted = true;
              logger.warn(
                {
                  model,
                  status: response.status,
                  errorType: errorInfo.errorType,
                  durationMs: Date.now() - startTime,
                },
                'GeminiSpeakingService: Non-retriable error encountered, aborting model chain',
              );
              return null;
            }

            // Retriable error (429, 500, 503): trip circuit breaker and failover
            cb.recordFailure(errorInfo, canExecuteResult.isProbe);
            cb.recordFallback();
            probeCompleted = true;

            const nextModel = this.models[i + 1] ?? null;
            logger.warn(
              {
                failedModel: model,
                nextModel,
                status: response.status,
                errorType: errorInfo.errorType,
                quotaType: errorInfo.quotaType,
                durationMs: Date.now() - startTime,
                cooldownUntil: cb.getStats().cooldownUntil,
              },
              'GeminiSpeakingService: Model returned retriable error, failing over to next model',
            );
            continue;
          }

          if (isWhisper) {
            const groqData = (await response.json()) as { text?: string };
            const transcribed = groqData.text?.trim();
            if (transcribed) {
              cb.recordSuccess(canExecuteResult.isProbe);
              probeCompleted = true;
              logger.info(
                { model, durationMs: Date.now() - startTime },
                'GeminiSpeakingService: Audio transcribed successfully via Groq Whisper',
              );
              return {
                transcript: transcribed,
                aiScore: 6.0,
                aiFeedback: '',
                modelUsed: model,
              };
            }

            logger.warn(
              { model, durationMs: Date.now() - startTime },
              'GeminiSpeakingService: Groq Whisper returned empty text, failing over',
            );
            cb.recordFailure(
              {
                isRetriable: true,
                errorType: 'EMPTY_CANDIDATE_RESPONSE',
                message: 'Groq Whisper returned empty text',
              },
              canExecuteResult.isProbe,
            );
            cb.recordFallback();
            probeCompleted = true;
            continue;
          }

          const data = (await response.json()) as {
            candidates?: Array<{
              content?: {
                parts?: Array<{
                  text?: string;
                  audioTranscription?: { text?: string };
                }>;
              };
            }>;
          };

          const candidatePart = data.candidates?.[0]?.content?.parts?.[0];
          if (isTranscribeOnly) {
            const transcribed =
              candidatePart?.audioTranscription?.text?.trim() ||
              candidatePart?.text?.trim();
            if (transcribed) {
              cb.recordSuccess(canExecuteResult.isProbe);
              probeCompleted = true;
              logger.info(
                { model, durationMs: Date.now() - startTime },
                'GeminiSpeakingService: Audio transcribed successfully via transcribe model',
              );
              return {
                transcript: transcribed,
                aiScore: 6.0,
                aiFeedback: '',
                modelUsed: model,
              };
            }
          }

          const rawText = candidatePart?.text;
          if (rawText) {
            const parsed = this.parseGeminiJson(rawText);
            if (parsed) {
              cb.recordSuccess(canExecuteResult.isProbe);
              probeCompleted = true;
              logger.info(
                {
                  model,
                  durationMs: Date.now() - startTime,
                  isProbe: canExecuteResult.isProbe,
                  isFallback: i > 0,
                },
                'GeminiSpeakingService: AI evaluation completed successfully',
              );
              return {
                ...parsed,
                modelUsed: model,
              };
            }

            // Model returned response but JSON was invalid or corrupted
            logger.warn(
              { model, durationMs: Date.now() - startTime },
              'GeminiSpeakingService: Model returned unparseable JSON, failing over',
            );
            cb.recordFailure(
              {
                isRetriable: true,
                errorType: 'INVALID_JSON_OUTPUT',
                message: 'Model returned malformed or unparseable JSON',
              },
              canExecuteResult.isProbe,
            );
            cb.recordFallback();
            probeCompleted = true;
            continue;
          }

          // No candidates or empty text
          logger.warn(
            { model, durationMs: Date.now() - startTime },
            'GeminiSpeakingService: Model returned empty candidate response, failing over',
          );
          cb.recordFailure(
            {
              isRetriable: true,
              errorType: 'EMPTY_CANDIDATE_RESPONSE',
              message: 'Model returned empty candidate response',
            },
            canExecuteResult.isProbe,
          );
          cb.recordFallback();
          probeCompleted = true;
          continue;
        } catch (callErr) {
          const errorInfo = classifyGeminiException(callErr);
          cb.recordFailure(errorInfo, canExecuteResult.isProbe);
          cb.recordFallback();
          probeCompleted = true;

          const nextModel = this.models[i + 1] ?? null;
          logger.warn(
            {
              failedModel: model,
              nextModel,
              errorType: errorInfo.errorType,
              message: errorInfo.message,
              durationMs: Date.now() - startTime,
              cooldownUntil: cb.getStats().cooldownUntil,
            },
            'GeminiSpeakingService: Model call threw exception, failing over',
          );
          continue;
        } finally {
          if (!probeCompleted && canExecuteResult.isProbe) {
            cb.releaseProbe();
          }
        }
      }

      // All candidate models failed or unavailable
      logger.error(
        { stats: this.getCircuitBreakerStats() },
        'GeminiSpeakingService: All candidate AI models failed, audio saved for manual review',
      );
      return null;
    } catch (error) {
      logger.error({ error }, 'GeminiSpeakingService: Unhandled error in evaluate, skipping AI evaluation');
      return null;
    }
  }

  public parseGeminiJson(raw: string): GeminiSpeakingEvaluationResult | null {
    try {
      let cleaned = raw.trim();
      const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (codeBlockMatch && codeBlockMatch[1]) {
        cleaned = codeBlockMatch[1].trim();
      } else {
        const jsonObjectMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          cleaned = jsonObjectMatch[0].trim();
        }
      }

      const obj = JSON.parse(cleaned) as {
        transcript?: unknown;
        aiScore?: unknown;
        aiFeedback?: unknown;
      };

      if (
        typeof obj.transcript === 'string' &&
        obj.transcript.trim().length > 0 &&
        typeof obj.aiFeedback === 'string' &&
        obj.aiFeedback.trim().length > 0
      ) {
        if (obj.aiScore === undefined || obj.aiScore === null) {
          return null; // Missing score — do not invent a default score
        }

        const rawScore =
          typeof obj.aiScore === 'number'
            ? obj.aiScore
            : typeof obj.aiScore === 'string'
            ? parseFloat(obj.aiScore.match(/\d+(\.\d+)?/)?.[0] ?? '')
            : NaN;

        if (Number.isNaN(rawScore) || rawScore < 0) {
          return null; // Invalid score representation
        }

        const score = Math.min(9.0, Math.max(1.0, Math.round(rawScore * 2) / 2));

        return {
          transcript: obj.transcript.trim(),
          aiScore: score,
          aiFeedback: obj.aiFeedback.trim(),
        };
      }
    } catch {
      // Fallback
    }
    return null;
  }
}
