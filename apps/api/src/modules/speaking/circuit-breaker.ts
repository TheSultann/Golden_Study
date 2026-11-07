import type {
  CanExecuteResult,
  CircuitBreakerConfig,
  CircuitBreakerState,
  ModelCircuitBreakerStats,
  ModelErrorInfo,
  QuotaType,
} from './circuit-breaker.types.js';

export class ModelCircuitBreaker {
  public readonly model: string;
  private readonly config: Required<CircuitBreakerConfig>;

  private state: CircuitBreakerState = 'CLOSED';
  private consecutiveFailures = 0;
  private cooldownUntil: number | null = null;
  private isProbing = false;

  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private totalFallbacks = 0;

  private lastErrorType?: string | undefined;
  private lastErrorStatus?: number | undefined;
  private lastErrorTime?: number | undefined;
  private lastQuotaType?: QuotaType | undefined;

  public constructor(model: string, config?: CircuitBreakerConfig) {
    this.model = model;
    this.config = {
      baseCooldownMs: config?.baseCooldownMs ?? 60_000,
      maxCooldownMs: config?.maxCooldownMs ?? 480_000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      dailyQuotaCooldownMs: config?.dailyQuotaCooldownMs ?? 6 * 3600 * 1000,
      jitter: config?.jitter ?? true,
      maxJitterMs: config?.maxJitterMs ?? 5000,
    };
  }

  public canExecute(now = Date.now()): CanExecuteResult {
    if (this.state === 'CLOSED') {
      this.totalRequests++;
      return { allowed: true, isProbe: false };
    }

    if (this.state === 'OPEN') {
      if (this.cooldownUntil !== null && now < this.cooldownUntil) {
        return {
          allowed: false,
          isProbe: false,
          reason: `Model ${this.model} is OPEN (cooldown active until ${new Date(this.cooldownUntil).toISOString()})`,
        };
      }

      // Cooldown expired: transition to HALF_OPEN and acquire probe lock
      this.state = 'HALF_OPEN';
      this.isProbing = true;
      this.totalRequests++;
      return { allowed: true, isProbe: true };
    }

    // state === 'HALF_OPEN'
    if (this.isProbing) {
      return {
        allowed: false,
        isProbe: false,
        reason: `Model ${this.model} is HALF_OPEN (trial probe already in progress)`,
      };
    }

    this.isProbing = true;
    this.totalRequests++;
    return { allowed: true, isProbe: true };
  }

  public recordSuccess(_isProbe = false): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.cooldownUntil = null;
    this.isProbing = false;
    this.successfulRequests++;
  }

  public recordFailure(errorInfo: ModelErrorInfo, _isProbe = false, now = Date.now()): void {
    this.failedRequests++;
    this.isProbing = false;
    this.consecutiveFailures++;
    this.state = 'OPEN';

    let cooldownMs: number;
    const jitter = this.config.jitter
      ? Math.floor(Math.random() * this.config.maxJitterMs)
      : 0;

    if (errorInfo.retryAfterMs !== undefined && errorInfo.retryAfterMs > 0) {
      cooldownMs = errorInfo.retryAfterMs + jitter;
    } else if (errorInfo.isDailyQuota) {
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(24, 0, 0, 0);
      const msUntilMidnight = tomorrow.getTime() - now;
      if (msUntilMidnight > 0) {
        cooldownMs = msUntilMidnight + jitter;
      } else {
        cooldownMs = this.config.dailyQuotaCooldownMs + jitter;
      }
    } else {
      const exp = Math.max(0, this.consecutiveFailures - 1);
      const baseBackoff = this.config.baseCooldownMs * Math.pow(this.config.backoffMultiplier, exp);
      const capped = Math.min(baseBackoff, this.config.maxCooldownMs);
      cooldownMs = capped + jitter;
    }

    this.cooldownUntil = now + cooldownMs;
    this.lastErrorType = errorInfo.errorType;
    this.lastErrorStatus = errorInfo.status;
    this.lastErrorTime = now;
    this.lastQuotaType = errorInfo.quotaType;
  }

  public recordNonRetriable(errorInfo?: ModelErrorInfo, _isProbe = false): void {
    this.isProbing = false;
    if (errorInfo) {
      this.lastErrorType = errorInfo.errorType;
      this.lastErrorStatus = errorInfo.status;
      this.lastErrorTime = Date.now();
      this.lastQuotaType = errorInfo.quotaType;
    }
  }

  public releaseProbe(): void {
    this.isProbing = false;
  }

  public recordFallback(): void {
    this.totalFallbacks++;
  }

  public getStats(): ModelCircuitBreakerStats {
    return {
      model: this.model,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      cooldownUntil: this.cooldownUntil,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      totalFallbacks: this.totalFallbacks,
      lastErrorType: this.lastErrorType,
      lastErrorStatus: this.lastErrorStatus,
      lastErrorTime: this.lastErrorTime,
      lastQuotaType: this.lastQuotaType,
      isProbing: this.isProbing,
    };
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.cooldownUntil = null;
    this.isProbing = false;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.totalFallbacks = 0;
    this.lastErrorType = undefined;
    this.lastErrorStatus = undefined;
    this.lastErrorTime = undefined;
    this.lastQuotaType = undefined;
  }
}
