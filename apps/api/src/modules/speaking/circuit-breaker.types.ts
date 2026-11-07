export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type QuotaType = 'RPM' | 'TPM' | 'RPD' | 'UNKNOWN';

export interface ModelErrorInfo {
  isRetriable: boolean;
  status?: number | undefined;
  errorType: string;
  message: string;
  retryAfterMs?: number | undefined;
  quotaType?: QuotaType | undefined;
  isDailyQuota?: boolean | undefined;
}

export interface CircuitBreakerConfig {
  baseCooldownMs?: number; // default: 60_000 (60s)
  maxCooldownMs?: number; // default: 480_000 (480s)
  backoffMultiplier?: number; // default: 2 (60 -> 120 -> 240 -> 480)
  dailyQuotaCooldownMs?: number; // default: 6 hours or until next UTC midnight
  jitter?: boolean; // default: true
  maxJitterMs?: number; // default: 5000 (0-5s)
}

export interface ModelCircuitBreakerStats {
  model: string;
  state: CircuitBreakerState;
  consecutiveFailures: number;
  cooldownUntil: number | null;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalFallbacks: number;
  lastErrorType?: string | undefined;
  lastErrorStatus?: number | undefined;
  lastErrorTime?: number | undefined;
  lastQuotaType?: QuotaType | undefined;
  isProbing?: boolean | undefined;
}

export interface CanExecuteResult {
  allowed: boolean;
  isProbe: boolean;
  reason?: string | undefined;
}
