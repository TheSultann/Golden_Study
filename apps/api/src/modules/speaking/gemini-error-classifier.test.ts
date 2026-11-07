import { describe, expect, it } from 'vitest';

import {
  classifyGeminiError,
  classifyGeminiException,
  parseRetryAfterHeader,
  parseRetryDelayString,
} from './gemini-error-classifier.js';

describe('Gemini Error Classifier', () => {
  it('parses retry delay string in seconds format', () => {
    expect(parseRetryDelayString('43.5s')).toBe(43500);
    expect(parseRetryDelayString('60s')).toBe(60000);
    expect(parseRetryDelayString('10')).toBe(10000);
    expect(parseRetryDelayString(15)).toBe(15000);
    expect(parseRetryDelayString(undefined)).toBeUndefined();
  });

  it('parses retry after header numeric and date formats', () => {
    expect(parseRetryAfterHeader('120')).toBe(120000);

    const futureDate = new Date(Date.now() + 30000).toUTCString();
    const parsed = parseRetryAfterHeader(futureDate);
    expect(parsed).toBeGreaterThan(25000);
    expect(parsed).toBeLessThanOrEqual(30000);

    expect(parseRetryAfterHeader(null)).toBeUndefined();
    expect(parseRetryAfterHeader('')).toBeUndefined();
  });

  it('classifies 400 Bad Request as non-retriable', () => {
    const info = classifyGeminiError(400, {}, JSON.stringify({
      error: { code: 400, message: 'Invalid field value', status: 'INVALID_ARGUMENT' },
    }));

    expect(info.isRetriable).toBe(false);
    expect(info.status).toBe(400);
    expect(info.errorType).toBe('BAD_REQUEST');
  });

  it('classifies 400 Audio Modality Not Supported with specific errorType', () => {
    const info = classifyGeminiError(400, {}, JSON.stringify({
      error: { code: 400, message: 'Audio input modality is not enabled for this model', status: 'INVALID_ARGUMENT' },
    }));

    expect(info.isRetriable).toBe(false);
    expect(info.errorType).toBe('AUDIO_MODALITY_NOT_SUPPORTED');
  });

  it('classifies 401 and 403 as non-retriable authentication errors', () => {
    const unauth = classifyGeminiError(401, {}, '{"error":{"message":"API key not valid"}}');
    expect(unauth.isRetriable).toBe(false);
    expect(unauth.errorType).toBe('UNAUTHORIZED');

    const forbidden = classifyGeminiError(403, {}, '{"error":{"message":"Permission denied"}}');
    expect(forbidden.isRetriable).toBe(false);
    expect(forbidden.errorType).toBe('FORBIDDEN');
  });

  it('classifies 429 Rate Limit with RetryInfo detail as retriable', () => {
    const body = JSON.stringify({
      error: {
        code: 429,
        message: 'Resource has been exhausted',
        status: 'RESOURCE_EXHAUSTED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '25.5s',
          },
        ],
      },
    });

    const info = classifyGeminiError(429, {}, body);
    expect(info.isRetriable).toBe(true);
    expect(info.errorType).toBe('RATE_LIMIT');
    expect(info.retryAfterMs).toBe(25500);
  });

  it('detects daily quota (RPD) from Google QuotaFailure details', () => {
    const body = JSON.stringify({
      error: {
        code: 429,
        message: 'Quota exceeded',
        status: 'RESOURCE_EXHAUSTED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [
              { description: 'Quota exceeded for GenerateContentRequestsPerDay' },
            ],
          },
        ],
      },
    });

    const info = classifyGeminiError(429, {}, body);
    expect(info.isRetriable).toBe(true);
    expect(info.isDailyQuota).toBe(true);
    expect(info.quotaType).toBe('RPD');
  });

  it('detects RPM quota from ErrorInfo metadata', () => {
    const body = JSON.stringify({
      error: {
        code: 429,
        message: 'Rate limit',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            metadata: { quota_limit: 'GenerateContentRequestsPerMinute' },
          },
        ],
      },
    });

    const info = classifyGeminiError(429, {}, body);
    expect(info.isRetriable).toBe(true);
    expect(info.isDailyQuota).toBe(false);
    expect(info.quotaType).toBe('RPM');
  });

  it('classifies 500, 502, 503, 504 server errors as retriable', () => {
    const err500 = classifyGeminiError(500, {}, 'Internal server error');
    expect(err500.isRetriable).toBe(true);
    expect(err500.errorType).toBe('INTERNAL_SERVER_ERROR');

    const err503 = classifyGeminiError(503, { 'retry-after': '30' }, 'Service unavailable');
    expect(err503.isRetriable).toBe(true);
    expect(err503.errorType).toBe('SERVICE_UNAVAILABLE');
    expect(err503.retryAfterMs).toBe(30000);
  });

  it('classifies exceptions: timeouts and network errors', () => {
    const timeoutErr = new Error('The operation was aborted due to timeout');
    timeoutErr.name = 'TimeoutError';
    const tInfo = classifyGeminiException(timeoutErr);
    expect(tInfo.isRetriable).toBe(true);
    expect(tInfo.errorType).toBe('TIMEOUT');

    const fetchErr = new TypeError('fetch failed');
    const fInfo = classifyGeminiException(fetchErr);
    expect(fInfo.isRetriable).toBe(true);
    expect(fInfo.errorType).toBe('NETWORK_ERROR');
  });

  it('detects TPM quota from ErrorInfo metadata and QuotaFailure details', () => {
    const errorInfoBody = JSON.stringify({
      error: {
        code: 429,
        message: 'Quota exceeded for tokens',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            metadata: { quota_limit: 'GenerateContentTokensPerMinutePerProject' },
          },
        ],
      },
    });
    const info1 = classifyGeminiError(429, {}, errorInfoBody);
    expect(info1.quotaType).toBe('TPM');

    const quotaFailureBody = JSON.stringify({
      error: {
        code: 429,
        message: 'Tokens limit',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [{ description: 'Exceeded tokens per minute limit' }],
          },
        ],
      },
    });
    const info2 = classifyGeminiError(429, {}, quotaFailureBody);
    expect(info2.quotaType).toBe('TPM');
  });

  it('redacts API keys in error and exception messages to prevent log leaks', () => {
    const exceptionWithKey = new Error('fetch failed: https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyD_EXAMPLE_SECRET_KEY_12345');
    const info = classifyGeminiException(exceptionWithKey);
    expect(info.message).not.toContain('AIzaSyD_EXAMPLE_SECRET_KEY_12345');
    expect(info.message).toContain('[REDACTED]');

    const errorBody = JSON.stringify({
      error: {
        code: 400,
        message: 'Bad key parameter key=AIzaSyD_TEST_SECRET_KEY_98765 is invalid',
      },
    });
    const errorInfo = classifyGeminiError(400, {}, errorBody);
    expect(errorInfo.message).not.toContain('AIzaSyD_TEST_SECRET_KEY_98765');
  });
});
