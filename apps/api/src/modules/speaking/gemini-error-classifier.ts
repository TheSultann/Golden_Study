import type { ModelErrorInfo, QuotaType } from './circuit-breaker.types.js';

interface GoogleRpcDetail {
  '@type'?: string;
  retryDelay?: string | number;
  violations?: Array<{ description?: string; subject?: string }>;
  metadata?: Record<string, string>;
}

interface GoogleApiErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: GoogleRpcDetail[];
  };
}

export function parseRetryDelayString(val: string | number | undefined): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') {
    return val > 0 ? val * 1000 : undefined;
  }
  const trimmed = val.trim();
  if (trimmed.endsWith('s')) {
    const num = parseFloat(trimmed.slice(0, -1));
    return !Number.isNaN(num) && num > 0 ? Math.round(num * 1000) : undefined;
  }
  const parsed = parseFloat(trimmed);
  return !Number.isNaN(parsed) && parsed > 0 ? Math.round(parsed * 1000) : undefined;
}

export function parseRetryAfterHeader(headerVal: string | null | undefined): number | undefined {
  if (!headerVal) return undefined;
  const trimmed = headerVal.trim();
  const seconds = parseFloat(trimmed);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return Math.round(seconds * 1000);
  }
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    const diff = parsedDate - Date.now();
    return diff > 0 ? diff : undefined;
  }
  return undefined;
}

export function redactSensitiveInfo(text: string): string {
  return text
    .replace(/(?:[?&]key=|key=)[^&\s]+/gi, 'key=[REDACTED]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_API_KEY]');
}

export function classifyGeminiError(
  status: number,
  headers: Headers | Record<string, string | null | undefined>,
  bodyText: string,
): ModelErrorInfo {
  let parsedBody: GoogleApiErrorBody | null = null;
  try {
    parsedBody = JSON.parse(bodyText) as GoogleApiErrorBody;
  } catch {
    // raw non-json text
  }

  const rawMessage = parsedBody?.error?.message || bodyText.slice(0, 300) || `HTTP ${status}`;
  const message = redactSensitiveInfo(rawMessage);

  // Non-retriable: 400 Bad Request
  if (status === 400) {
    const isAudioUnsupported =
      message.toLowerCase().includes('audio input modality') ||
      message.toLowerCase().includes('audio modality');
    return {
      isRetriable: false,
      status,
      errorType: isAudioUnsupported ? 'AUDIO_MODALITY_NOT_SUPPORTED' : 'BAD_REQUEST',
      message,
    };
  }

  // Non-retriable: 401 Unauthorized / 403 Forbidden
  if (status === 401 || status === 403) {
    return {
      isRetriable: false,
      status,
      errorType: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
      message,
    };
  }

  // 404 Model Not Found
  if (status === 404) {
    return {
      isRetriable: false,
      status,
      errorType: 'MODEL_NOT_FOUND',
      message,
    };
  }

  // Extract retry-after from header
  const rawHeader =
    headers instanceof Headers
      ? headers.get('retry-after')
      : headers['retry-after'] || headers['Retry-After'];
  let retryAfterMs = parseRetryAfterHeader(rawHeader);

  // Extract retryDelay from Google RPC details if available
  let isDailyQuota = false;
  let quotaType: QuotaType = 'UNKNOWN';

  if (parsedBody?.error?.details) {
    for (const detail of parsedBody.error.details) {
      const type = detail['@type'] || '';
      if (type.includes('RetryInfo') && detail.retryDelay && retryAfterMs === undefined) {
        retryAfterMs = parseRetryDelayString(detail.retryDelay);
      }
      if (type.includes('QuotaFailure')) {
        const desc = detail.violations?.[0]?.description?.toLowerCase() || '';
        if (desc.includes('day') || desc.includes('perday') || desc.includes('rpd')) {
          isDailyQuota = true;
          quotaType = 'RPD';
        } else if (desc.includes('token') || desc.includes('tpm')) {
          quotaType = 'TPM';
        } else if (desc.includes('minute') || desc.includes('perminute') || desc.includes('rpm')) {
          quotaType = 'RPM';
        }
      }
      if (type.includes('ErrorInfo')) {
        const quotaLimit = detail.metadata?.quota_limit?.toLowerCase() || '';
        if (quotaLimit.includes('day') || quotaLimit.includes('rpd')) {
          isDailyQuota = true;
          quotaType = 'RPD';
        } else if (quotaLimit.includes('token') || quotaLimit.includes('tpm')) {
          quotaType = 'TPM';
        } else if (quotaLimit.includes('minute') || quotaLimit.includes('rpm')) {
          quotaType = 'RPM';
        }
      }
    }
  }

  // Fallback keyword detection for quota type
  const lowerMsg = message.toLowerCase();
  if (
    lowerMsg.includes('requests per day') ||
    lowerMsg.includes('requestsperday') ||
    lowerMsg.includes('per day') ||
    lowerMsg.includes('perday') ||
    lowerMsg.includes('daily limit') ||
    lowerMsg.includes('day quota') ||
    lowerMsg.includes('rpd')
  ) {
    isDailyQuota = true;
    quotaType = 'RPD';
  } else if (
    lowerMsg.includes('tokens per minute') ||
    lowerMsg.includes('tokensperminute') ||
    lowerMsg.includes('tpm')
  ) {
    quotaType = 'TPM';
  } else if (
    lowerMsg.includes('requests per minute') ||
    lowerMsg.includes('requestsperminute') ||
    lowerMsg.includes('per minute') ||
    lowerMsg.includes('perminute') ||
    lowerMsg.includes('rpm')
  ) {
    quotaType = 'RPM';
  }

  // 429 Rate Limit / Quota
  if (status === 429) {
    return {
      isRetriable: true,
      status,
      errorType: 'RATE_LIMIT',
      message,
      retryAfterMs,
      quotaType,
      isDailyQuota,
    };
  }

  // 5xx Server Errors (500, 502, 503, 504)
  if (status >= 500) {
    const errorType =
      status === 503
        ? 'SERVICE_UNAVAILABLE'
        : status === 502
        ? 'BAD_GATEWAY'
        : status === 504
        ? 'GATEWAY_TIMEOUT'
        : 'INTERNAL_SERVER_ERROR';

    return {
      isRetriable: true,
      status,
      errorType,
      message,
      retryAfterMs,
    };
  }

  // Default fallback for unexpected 4xx
  return {
    isRetriable: false,
    status,
    errorType: 'CLIENT_ERROR',
    message,
  };
}

export function classifyGeminiException(error: unknown): ModelErrorInfo {
  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    const rawMsg = error.message || '';
    const msg = rawMsg.toLowerCase();
    const sanitizedMsg = redactSensitiveInfo(rawMsg);

    if (name.includes('abort') || name.includes('timeout') || msg.includes('timeout') || msg.includes('aborted')) {
      return {
        isRetriable: true,
        errorType: 'TIMEOUT',
        message: sanitizedMsg || 'Request timeout',
      };
    }

    if (
      msg.includes('fetch failed') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('network')
    ) {
      return {
        isRetriable: true,
        errorType: 'NETWORK_ERROR',
        message: sanitizedMsg,
      };
    }

    return {
      isRetriable: true,
      errorType: 'UNKNOWN_ERROR',
      message: sanitizedMsg,
    };
  }

  return {
    isRetriable: true,
    errorType: 'UNKNOWN_ERROR',
    message: redactSensitiveInfo(String(error)),
  };
}
