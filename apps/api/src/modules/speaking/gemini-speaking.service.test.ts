import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GeminiSpeakingService } from './gemini-speaking.service.js';

describe('GeminiSpeakingService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Base behavior & parsing
  it('returns null when API key is not configured for manual teacher review', async () => {
    const service = new GeminiSpeakingService(undefined);
    const result = await service.evaluate({
      audioUrl: 'https://cdn.example.com/audio/sample.mp3',
      topicTitle: 'Technology in Education',
      topicDescription: 'How computers affect learning',
    });

    expect(result).toBeNull();
  });

  it('parses Gemini JSON surrounded by markdown code fences and conversational commentary', () => {
    const service = new GeminiSpeakingService('test-key');
    const raw = `Here is the comprehensive IELTS assessment for the student:
\`\`\`json
{
  "transcript": "I believe that traveling broadens one's perspective substantially.",
  "aiScore": "7.5",
  "aiFeedback": "## 📊 IELTS Speaking Tahlili (Band 7.5)\\n\\nExcellent fluency and vocabulary."
}
\`\`\`
I hope this evaluation helps!`;

    const parsed = service.parseGeminiJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.transcript).toBe("I believe that traveling broadens one's perspective substantially.");
    expect(parsed?.aiScore).toBe(7.5);
    expect(parsed?.aiFeedback).toContain('Band 7.5');
  });

  it('parses raw JSON object without markdown code fences', () => {
    const service = new GeminiSpeakingService('test-key');
    const raw = `{"transcript": "Spoken sentence", "aiScore": 8.0, "aiFeedback": "Very good"}`;

    const parsed = service.parseGeminiJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.transcript).toBe('Spoken sentence');
    expect(parsed?.aiScore).toBe(8.0);
  });

  it('clamps out-of-range AI scores between 1.0 and 9.0', () => {
    const service = new GeminiSpeakingService('test-key');
    const high = service.parseGeminiJson('{"transcript": "Test", "aiScore": 12.5, "aiFeedback": "High"}');
    expect(high?.aiScore).toBe(9.0);

    const low = service.parseGeminiJson('{"transcript": "Test", "aiScore": 0.2, "aiFeedback": "Low"}');
    expect(low?.aiScore).toBe(1.0);
  });

  it('returns null on invalid JSON', () => {
    const service = new GeminiSpeakingService('test-key');
    expect(service.parseGeminiJson('This is not json at all')).toBeNull();
  });

  // Scenario 1: Primary model successfully processes request
  it('Scenario 1: Primary model (gemini-3.8-flash) successfully processes request', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
      circuitBreakerConfig: { jitter: false },
    });

    const calls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      calls.push(urlStr);
      if (urlStr.includes('gemini-3.8-flash')) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        transcript: 'Student response transcribed',
                        aiScore: 7.0,
                        aiFeedback: 'Good flow and clear ideas',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Should not be called', { status: 500 });
    }) as typeof fetch;

    const result = await service.evaluate({
      audioUrl: 'https://example.com/audio.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'Travel',
    });

    expect(result).not.toBeNull();
    expect(result?.modelUsed).toBe('gemini-3.8-flash');
    expect(result?.aiScore).toBe(7.0);
    expect(result?.transcript).toBe('Student response transcribed');
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain('gemini-3.8-flash');

    const stats = service.getCircuitBreakerStats();
    expect(stats['gemini-3.8-flash']?.state).toBe('CLOSED');
    expect(stats['gemini-3.8-flash']?.successfulRequests).toBe(1);
  });

  // Scenario 2: Primary model returns 429 — automatically falls back to secondary model
  it('Scenario 2: Primary model returns 429 — falls back to secondary model (gemini-3.6-flash)', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
      circuitBreakerConfig: { jitter: false },
    });

    const calls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      calls.push(urlStr);
      if (urlStr.includes('gemini-3.8-flash')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              message: 'Resource exhausted',
              status: 'RESOURCE_EXHAUSTED',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (urlStr.includes('gemini-3.6-flash')) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        transcript: 'Fallback model transcribed this',
                        aiScore: 6.5,
                        aiFeedback: 'Solid performance',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Unexpected', { status: 500 });
    }) as typeof fetch;

    const result = await service.evaluate({
      audioUrl: 'https://example.com/audio.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'Holidays',
    });

    expect(result).not.toBeNull();
    expect(result?.modelUsed).toBe('gemini-3.6-flash');
    expect(result?.aiScore).toBe(6.5);
    expect(calls.length).toBe(2);

    const stats = service.getCircuitBreakerStats();
    expect(stats['gemini-3.8-flash']?.state).toBe('OPEN');
    expect(stats['gemini-3.8-flash']?.consecutiveFailures).toBe(1);
    expect(stats['gemini-3.6-flash']?.state).toBe('CLOSED');
    expect(stats['gemini-3.6-flash']?.successfulRequests).toBe(1);
  });

  // Scenario 3: Primary model returns 503 — triggers failover
  it('Scenario 3: Primary model returns 503 Service Unavailable — triggers failover', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
      circuitBreakerConfig: { jitter: false },
    });

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('gemini-3.8-flash')) {
        return new Response('Backend temporarily unavailable', { status: 503 });
      }
      if (urlStr.includes('gemini-3.6-flash')) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        transcript: 'Recovered via 3.6 flash',
                        aiScore: 8.0,
                        aiFeedback: 'Excellent',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Error', { status: 500 });
    }) as typeof fetch;

    const result = await service.evaluate({
      audioUrl: 'https://example.com/audio.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'Work',
    });

    expect(result).not.toBeNull();
    expect(result?.modelUsed).toBe('gemini-3.6-flash');
    expect(result?.aiScore).toBe(8.0);
  });

  // Scenario 4: All models unavailable — returns controlled null without crashing
  it('Scenario 4: All models unavailable — returns controlled null', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
      circuitBreakerConfig: { jitter: false },
    });

    globalThis.fetch = (async () => {
      return new Response('Service down', { status: 500 });
    }) as typeof fetch;

    const result = await service.evaluate({
      audioUrl: 'https://example.com/audio.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'Sports',
    });

    expect(result).toBeNull();
    const stats = service.getCircuitBreakerStats();
    expect(stats['gemini-3.8-flash']?.state).toBe('OPEN');
    expect(stats['gemini-3.6-flash']?.state).toBe('OPEN');
  });

  // Scenario 5: After cooldown, only one trial probe is allowed in HALF_OPEN
  it('Scenario 5: After cooldown, only ONE probe is permitted; other concurrent requests skip to fallback', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
      circuitBreakerConfig: { baseCooldownMs: 1000, jitter: false },
    });

    const cb38 = service.getCircuitBreaker('gemini-3.8-flash')!;
    const now = Date.now();

    // Trip circuit breaker on 3.8
    cb38.recordFailure(
      { isRetriable: true, errorType: 'RATE_LIMIT', message: '429' },
      false,
      now - 2000, // Happened 2s ago, so 1s cooldown has already expired!
    );
    expect(cb38.getStats().state).toBe('OPEN');

    // First check acquires probe lock -> transitions to HALF_OPEN
    const probeCheck = cb38.canExecute(now);
    expect(probeCheck.allowed).toBe(true);
    expect(probeCheck.isProbe).toBe(true);
    expect(cb38.getStats().state).toBe('HALF_OPEN');

    // Concurrent check while probe is in progress -> rejected, must fallback
    const concurrentCheck = cb38.canExecute(now);
    expect(concurrentCheck.allowed).toBe(false);
    expect(concurrentCheck.reason).toContain('trial probe already in progress');

    // Probe succeeds -> restored to CLOSED
    cb38.recordSuccess(true);
    expect(cb38.getStats().state).toBe('CLOSED');
    expect(cb38.canExecute(now).allowed).toBe(true);
  });

  // Scenario 6: Daily quota (RPD) applies long cooldown instead of 60s
  it('Scenario 6: Daily quota (RPD) applies cooldown until UTC midnight instead of 60s', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
      circuitBreakerConfig: { dailyQuotaCooldownMs: 6 * 3600 * 1000, jitter: false },
    });

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('gemini-3.8-flash')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              message: 'Quota exceeded for GenerateContentRequestsPerDay',
              status: 'RESOURCE_EXHAUSTED',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ transcript: 'ok', aiScore: 7, aiFeedback: 'ok' }) }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    await service.evaluate({
      audioUrl: 'https://example.com/audio.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'Art',
    });

    const stats = service.getCircuitBreakerStats();
    const cbStats = stats['gemini-3.8-flash']!;
    expect(cbStats.state).toBe('OPEN');
    expect(cbStats.lastQuotaType).toBe('RPD');

    // Cooldown must be well over 60 seconds (hours until midnight or min 6 hours)
    const cooldownDuration = cbStats.cooldownUntil! - Date.now();
    expect(cooldownDuration).toBeGreaterThan(60_000 * 10);
  });

  // Scenario 7: 400 and 401 errors do NOT cause model switching and do NOT trip circuit breaker
  it('Scenario 7: 400 Bad Request does not switch model and does not trip circuit breaker', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
    });

    const calledUrls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      calledUrls.push(url.toString());
      return new Response(
        JSON.stringify({
          error: {
            code: 400,
            message: 'Invalid argument provided',
            status: 'INVALID_ARGUMENT',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const result = await service.evaluate({
      audioUrl: 'https://example.com/corrupt.ogg',
      audioBase64: 'corrupted-base64',
      topicTitle: 'Music',
    });

    expect(result).toBeNull();
    // Only primary model was called — did NOT failover!
    expect(calledUrls.length).toBe(1);
    expect(calledUrls[0]).toContain('gemini-3.8-flash');

    // Circuit breaker remains CLOSED because 400 is client error
    const stats = service.getCircuitBreakerStats();
    expect(stats['gemini-3.8-flash']?.state).toBe('CLOSED');
  });

  it('Scenario 7b: 401 Unauthorized does not switch model and halts immediately', async () => {
    const service = new GeminiSpeakingService('invalid-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
    });

    const calledUrls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      calledUrls.push(url.toString());
      return new Response(
        JSON.stringify({
          error: {
            code: 401,
            message: 'API key not valid',
            status: 'UNAUTHENTICATED',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const result = await service.evaluate({
      audioUrl: 'https://example.com/audio.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'Books',
    });

    expect(result).toBeNull();
    expect(calledUrls.length).toBe(1);
    expect(service.getCircuitBreakerStats()['gemini-3.8-flash']?.state).toBe('CLOSED');
  });

  // Scenario 8: Malformed JSON output is rejected and triggers failover
  it('Scenario 8: Model returning malformed JSON output is rejected and triggers failover', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
      circuitBreakerConfig: { jitter: false },
    });

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('gemini-3.8-flash')) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: 'This is not valid JSON at all: {"broken": true' }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      transcript: 'Recovered after invalid JSON',
                      aiScore: 7.0,
                      aiFeedback: 'Feedback',
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const result = await service.evaluate({
      audioUrl: 'https://example.com/audio.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'Nature',
    });

    expect(result).not.toBeNull();
    expect(result?.modelUsed).toBe('gemini-3.6-flash');
    expect(result?.transcript).toBe('Recovered after invalid JSON');
  });

  // Scenario 9: Idempotency & non-redundant evaluation
  it('Scenario 9: Single model evaluation does not make redundant calls after success', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
    });

    let callsCount = 0;
    globalThis.fetch = (async () => {
      callsCount++;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      transcript: 'Single call',
                      aiScore: 7.5,
                      aiFeedback: 'Done',
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const res = await service.evaluate({
      audioUrl: 'https://example.com/audio.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'Cities',
    });

    expect(res).not.toBeNull();
    // Exactly 1 network request was made, secondary model was never contacted
    expect(callsCount).toBe(1);
  });

  // Scenario 10: Parallel concurrent requests correctly use fallback when primary circuit is OPEN
  it('Scenario 10: Concurrent requests cleanly route to healthy fallback when primary model is OPEN', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
      circuitBreakerConfig: { baseCooldownMs: 60_000, jitter: false },
    });

    // Manually trip gemini-3.8-flash
    service
      .getCircuitBreaker('gemini-3.8-flash')!
      .recordFailure(
        { isRetriable: true, errorType: 'RATE_LIMIT', message: '429' },
        false,
        Date.now(),
      );

    const calledModels: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('gemini-3.6-flash')) {
        calledModels.push('gemini-3.6-flash');
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        transcript: 'Concurrent response',
                        aiScore: 7.0,
                        aiFeedback: 'Good',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      calledModels.push('unexpected');
      return new Response('Error', { status: 500 });
    }) as typeof fetch;

    // Launch 5 concurrent requests
    const promises = Array.from({ length: 5 }, () =>
      service.evaluate({
        audioUrl: 'https://example.com/audio.ogg',
        audioBase64: 'UklGRigAAABXQVZF',
        topicTitle: 'Technology',
      }),
    );

    const results = await Promise.all(promises);

    expect(results.length).toBe(5);
    for (const res of results) {
      expect(res).not.toBeNull();
      expect(res?.modelUsed).toBe('gemini-3.6-flash');
    }
    // All 5 requests routed directly to gemini-3.6-flash without stalling
    expect(calledModels.filter((m) => m === 'gemini-3.6-flash').length).toBe(5);
  });

  // Edge Case A: parseGeminiJson rejects missing or null aiScore without fabricating 6.5
  it('Edge Case: parseGeminiJson returns null when aiScore is missing or null (does not invent 6.5)', () => {
    const service = new GeminiSpeakingService('test-key');

    // Missing aiScore
    const missingScore = service.parseGeminiJson(
      '{"transcript": "Spoken text", "aiFeedback": "Detailed feedback without score"}',
    );
    expect(missingScore).toBeNull();

    // null aiScore
    const nullScore = service.parseGeminiJson(
      '{"transcript": "Spoken text", "aiScore": null, "aiFeedback": "Feedback"}',
    );
    expect(nullScore).toBeNull();

    // non-numeric aiScore
    const nanScore = service.parseGeminiJson(
      '{"transcript": "Spoken text", "aiScore": "not a score", "aiFeedback": "Feedback"}',
    );
    expect(nanScore).toBeNull();
  });

  // Edge Case B: Model returning missing score triggers failover to fallback model
  it('Edge Case: Model returning JSON without aiScore triggers failover to secondary model', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
      circuitBreakerConfig: { jitter: false },
    });

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('gemini-3.8-flash')) {
        // Model 1 returns valid JSON but with NO aiScore
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify({ transcript: 'Hello', aiFeedback: 'Good' }) }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      transcript: 'Recovered with score',
                      aiScore: 7.5,
                      aiFeedback: 'Complete result',
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const result = await service.evaluate({
      audioUrl: 'https://example.com/audio.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'Education',
    });

    expect(result).not.toBeNull();
    expect(result?.modelUsed).toBe('gemini-3.6-flash');
    expect(result?.aiScore).toBe(7.5);
  });

  // Edge Case C: 400 Bad Request during probe in HALF_OPEN releases probe lock
  it('Edge Case: 400 Bad Request during probe in HALF_OPEN releases probe lock without permanent deadlock', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
      circuitBreakerConfig: { baseCooldownMs: 1000, jitter: false },
    });

    const cb38 = service.getCircuitBreaker('gemini-3.8-flash')!;
    const now = Date.now();

    // Trip circuit breaker 2 seconds ago
    cb38.recordFailure(
      { isRetriable: true, errorType: 'RATE_LIMIT', message: '429' },
      false,
      now - 2000,
    );

    // Mock API to return 400 Bad Request
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          error: { code: 400, message: 'Bad request on student audio', status: 'INVALID_ARGUMENT' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    // Execute probe request which returns 400
    const probeRes = await service.evaluate({
      audioUrl: 'https://example.com/bad.ogg',
      audioBase64: 'corrupt',
      topicTitle: 'Probe Test',
    });
    expect(probeRes).toBeNull();

    // Verify probe lock was released and NOT left permanently active!
    expect(cb38.getStats().isProbing).toBe(false);

    // Next request is NOT deadlocked and is allowed to probe
    const nextCheck = cb38.canExecute(Date.now());
    expect(nextCheck.allowed).toBe(true);
    expect(nextCheck.isProbe).toBe(true);
  });

  // Edge Case D: Overall timeout budget is strictly respected
  it('Edge Case: Overall request timeout budget terminates model chain without indefinite hangs', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'gemini-3.6-flash'],
      timeoutMs: 100, // 100ms total timeout
      perModelTimeoutMs: 200,
    });

    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts++;
      // Simulate delay longer than overall timeout
      await new Promise((r) => setTimeout(r, 120));
      return new Response('Too slow', { status: 500 });
    }) as typeof fetch;

    const res = await service.evaluate({
      audioUrl: 'https://example.com/audio.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'Timeout',
    });

    expect(res).toBeNull();
    // After 1st attempt exceeded overall deadline, 2nd model was not invoked
    expect(attempts).toBe(1);
  });

  // Edge Case E: Request uses x-goog-api-key header and does not expose key in query parameters
  it('Edge Case: Request uses x-goog-api-key header and does not put apiKey in URL query parameters', async () => {
    const service = new GeminiSpeakingService('SUPER_SECRET_KEY', {
      models: ['gemini-3.8-flash'],
    });

    let sentUrl = '';
    let sentHeader: string | null = null;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      sentUrl = url.toString();
      const headers = init?.headers as Record<string, string> | undefined;
      sentHeader = headers?.['x-goog-api-key'] ?? null;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ transcript: 'ok', aiScore: 7.0, aiFeedback: 'ok' }) }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    await service.evaluate({
      audioUrl: 'https://example.com/audio.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'Key Security',
    });

    expect(sentUrl).not.toContain('SUPER_SECRET_KEY');
    expect(sentUrl).not.toContain('key=');
    expect(sentHeader).toBe('SUPER_SECRET_KEY');
  });

  // Edge Case F: Audio data could not be retrieved -> returns null without calling Gemini
  it('Edge Case: Returns null when audio cannot be retrieved from audioUrl without calling AI models', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash'],
    });

    let geminiCalled = false;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('google')) {
        geminiCalled = true;
        return new Response('Gemini', { status: 200 });
      }
      // Audio download fails
      return new Response('Audio Not Found', { status: 404 });
    }) as typeof fetch;

    const res = await service.evaluate({
      audioUrl: 'https://cdn.example.com/missing.mp3',
      topicTitle: 'Missing Audio',
    });

    expect(res).toBeNull();
    expect(geminiCalled).toBe(false);
  });

  it('Scenario 9: Falls back to whisper-large-v3 when previous models exhaust quota', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.8-flash', 'whisper-large-v3'],
      circuitBreakerConfig: { jitter: false },
    });

    const calls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      calls.push(urlStr);
      if (urlStr.includes('gemini-3.8-flash')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              message: 'Quota exceeded for GenerateContentRequestsPerDay',
              status: 'RESOURCE_EXHAUSTED',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (urlStr.includes('groq.com')) {
        return new Response(
          JSON.stringify({
            text: 'Verbatim transcription from Whisper Large v3',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const res = await service.evaluate({
      audioUrl: 'https://example.com/sample.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'My Experience',
    });

    expect(res).not.toBeNull();
    expect(res?.modelUsed).toBe('whisper-large-v3');
    expect(res?.transcript).toBe('Verbatim transcription from Whisper Large v3');
    expect(res?.aiScore).toBe(6.0);
    expect(res?.aiFeedback).toBe('');
    expect(calls.length).toBe(2);
    expect(calls[0]).toContain('gemini-3.8-flash');
    expect(calls[1]).toContain('groq.com');
  });

  it('Scenario 10: gemini-3.5-transcribe parses audioTranscription part', async () => {
    const service = new GeminiSpeakingService('test-key', {
      models: ['gemini-3.5-transcribe'],
      circuitBreakerConfig: { jitter: false },
    });

    globalThis.fetch = (async (url: string | URL | Request) => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ audioTranscription: { text: 'Verbatim transcription from Google transcribe' } }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const res = await service.evaluate({
      audioUrl: 'https://example.com/sample.ogg',
      audioBase64: 'UklGRigAAABXQVZF',
      topicTitle: 'Practice',
    });

    expect(res).not.toBeNull();
    expect(res?.modelUsed).toBe('gemini-3.5-transcribe');
    expect(res?.transcript).toBe('Verbatim transcription from Google transcribe');
    expect(res?.aiScore).toBe(6.0);
    expect(res?.aiFeedback).toBe('');
  });
});
