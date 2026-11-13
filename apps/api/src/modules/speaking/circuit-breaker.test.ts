import { describe, expect, it } from 'vitest';

import { ModelCircuitBreaker } from './circuit-breaker.js';

describe('ModelCircuitBreaker', () => {
  it('starts in CLOSED state and allows requests', () => {
    const cb = new ModelCircuitBreaker('gemini-3.6-flash');
    const check = cb.canExecute();
    expect(check.allowed).toBe(true);
    expect(check.isProbe).toBe(false);

    const stats = cb.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.consecutiveFailures).toBe(0);
    expect(stats.cooldownUntil).toBeNull();
    expect(stats.totalRequests).toBe(1);
  });

  it('transitions to OPEN on retriable failure with exponential backoff', () => {
    const cb = new ModelCircuitBreaker('gemini-3.6-flash', {
      baseCooldownMs: 60_000,
      backoffMultiplier: 2,
      maxCooldownMs: 480_000,
      jitter: false,
    });

    const now = 1_000_000;

    // Failure 1: 60s
    cb.recordFailure(
      { isRetriable: true, errorType: 'RATE_LIMIT', message: 'Quota 429' },
      false,
      now,
    );
    expect(cb.getStats().state).toBe('OPEN');
    expect(cb.getStats().consecutiveFailures).toBe(1);
    expect(cb.getStats().cooldownUntil).toBe(now + 60_000);

    // Failure 2: 120s
    cb.recordFailure(
      { isRetriable: true, errorType: 'RATE_LIMIT', message: 'Quota 429' },
      false,
      now,
    );
    expect(cb.getStats().consecutiveFailures).toBe(2);
    expect(cb.getStats().cooldownUntil).toBe(now + 120_000);

    // Failure 3: 240s
    cb.recordFailure(
      { isRetriable: true, errorType: 'RATE_LIMIT', message: 'Quota 429' },
      false,
      now,
    );
    expect(cb.getStats().consecutiveFailures).toBe(3);
    expect(cb.getStats().cooldownUntil).toBe(now + 240_000);

    // Failure 4: 480s (max)
    cb.recordFailure(
      { isRetriable: true, errorType: 'RATE_LIMIT', message: 'Quota 429' },
      false,
      now,
    );
    expect(cb.getStats().consecutiveFailures).toBe(4);
    expect(cb.getStats().cooldownUntil).toBe(now + 480_000);

    // Failure 5: capped at 480s
    cb.recordFailure(
      { isRetriable: true, errorType: 'RATE_LIMIT', message: 'Quota 429' },
      false,
      now,
    );
    expect(cb.getStats().consecutiveFailures).toBe(5);
    expect(cb.getStats().cooldownUntil).toBe(now + 480_000);
  });

  it('respects explicit retryAfterMs from Google API when provided', () => {
    const cb = new ModelCircuitBreaker('gemini-3.6-flash', { jitter: false });
    const now = 1_000_000;

    cb.recordFailure(
      {
        isRetriable: true,
        errorType: 'RATE_LIMIT',
        message: 'Rate limit with retry-after',
        retryAfterMs: 45_000,
      },
      false,
      now,
    );

    expect(cb.getStats().cooldownUntil).toBe(now + 45_000);
  });

  it('applies daily quota cooldown until UTC midnight', () => {
    const cb = new ModelCircuitBreaker('gemini-3.6-flash', {
      dailyQuotaCooldownMs: 6 * 3600 * 1000,
      jitter: false,
    });

    // Assume current time is 18:00 UTC (6 hours before midnight)
    const fixedNow = new Date('2026-11-07T18:00:00.000Z').getTime();
    cb.recordFailure(
      {
        isRetriable: true,
        errorType: 'RATE_LIMIT',
        message: 'Daily quota exceeded',
        isDailyQuota: true,
        quotaType: 'RPD',
      },
      false,
      fixedNow,
    );

    const expectedMidnight = new Date('2026-11-08T00:00:00.000Z').getTime();
    expect(cb.getStats().cooldownUntil).toBe(expectedMidnight);
  });

  it('blocks requests while cooldown is active', () => {
    const cb = new ModelCircuitBreaker('gemini-3.6-flash', {
      baseCooldownMs: 60_000,
      jitter: false,
    });
    const now = 1_000_000;

    cb.recordFailure(
      { isRetriable: true, errorType: 'RATE_LIMIT', message: 'Quota' },
      false,
      now,
    );

    // 10 seconds later: still in cooldown
    const checkBefore = cb.canExecute(now + 10_000);
    expect(checkBefore.allowed).toBe(false);
    expect(checkBefore.isProbe).toBe(false);
    expect(checkBefore.reason).toContain('OPEN');
  });

  it('allows only ONE trial probe in HALF_OPEN after cooldown expires', () => {
    const cb = new ModelCircuitBreaker('gemini-3.6-flash', {
      baseCooldownMs: 60_000,
      jitter: false,
    });
    const now = 1_000_000;

    cb.recordFailure(
      { isRetriable: true, errorType: 'SERVICE_UNAVAILABLE', message: '503' },
      false,
      now,
    );

    const afterCooldown = now + 60_001;

    // First request after cooldown: acquires probe lock
    const firstCheck = cb.canExecute(afterCooldown);
    expect(firstCheck.allowed).toBe(true);
    expect(firstCheck.isProbe).toBe(true);
    expect(cb.getStats().state).toBe('HALF_OPEN');

    // Concurrent second request: rejected because probe is already in progress
    const secondCheck = cb.canExecute(afterCooldown);
    expect(secondCheck.allowed).toBe(false);
    expect(secondCheck.isProbe).toBe(false);
    expect(secondCheck.reason).toContain('trial probe already in progress');
  });

  it('restores CLOSED state when probe succeeds', () => {
    const cb = new ModelCircuitBreaker('gemini-3.6-flash', {
      baseCooldownMs: 60_000,
      jitter: false,
    });
    const now = 1_000_000;

    cb.recordFailure(
      { isRetriable: true, errorType: 'TIMEOUT', message: 'timeout' },
      false,
      now,
    );
    cb.canExecute(now + 60_001); // transitions to HALF_OPEN probe

    cb.recordSuccess(true);

    const stats = cb.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.consecutiveFailures).toBe(0);
    expect(stats.cooldownUntil).toBeNull();
    expect(stats.successfulRequests).toBe(1);

    // Next request is normal CLOSED request
    const nextCheck = cb.canExecute(now + 70_000);
    expect(nextCheck.allowed).toBe(true);
    expect(nextCheck.isProbe).toBe(false);
  });

  it('re-opens circuit with increased cooldown when probe fails', () => {
    const cb = new ModelCircuitBreaker('gemini-3.6-flash', {
      baseCooldownMs: 60_000,
      backoffMultiplier: 2,
      jitter: false,
    });
    const now = 1_000_000;

    // Failure 1
    cb.recordFailure(
      { isRetriable: true, errorType: 'RATE_LIMIT', message: '429' },
      false,
      now,
    );
    cb.canExecute(now + 60_001); // HALF_OPEN probe

    // Probe fails -> Failure 2
    cb.recordFailure(
      { isRetriable: true, errorType: 'RATE_LIMIT', message: '429 again' },
      true,
      now + 60_005,
    );

    const stats = cb.getStats();
    expect(stats.state).toBe('OPEN');
    expect(stats.consecutiveFailures).toBe(2);
    expect(stats.cooldownUntil).toBe(now + 60_005 + 120_000);
  });

  it('releases probe lock with releaseProbe without deadlocking HALF_OPEN state', () => {
    const cb = new ModelCircuitBreaker('gemini-3.6-flash', {
      baseCooldownMs: 60_000,
      jitter: false,
    });
    const now = 1_000_000;

    cb.recordFailure(
      { isRetriable: true, errorType: 'TIMEOUT', message: 'timeout' },
      false,
      now,
    );
    const probe = cb.canExecute(now + 60_001);
    expect(probe.allowed).toBe(true);
    expect(probe.isProbe).toBe(true);
    expect(cb.getStats().isProbing).toBe(true);

    // Call releaseProbe (e.g. on client error or unhandled abortion)
    cb.releaseProbe();
    expect(cb.getStats().isProbing).toBe(false);

    // Subsequent request is allowed to probe again, not locked out!
    const nextProbe = cb.canExecute(now + 60_002);
    expect(nextProbe.allowed).toBe(true);
    expect(nextProbe.isProbe).toBe(true);
  });

  it('recordNonRetriable releases probe lock and preserves circuit breaker state', () => {
    const cb = new ModelCircuitBreaker('gemini-3.6-flash', {
      baseCooldownMs: 60_000,
      jitter: false,
    });
    const now = 1_000_000;

    cb.recordFailure(
      { isRetriable: true, errorType: 'RATE_LIMIT', message: '429' },
      false,
      now,
    );
    cb.canExecute(now + 60_001); // in HALF_OPEN with probe active
    expect(cb.getStats().isProbing).toBe(true);

    cb.recordNonRetriable({
      isRetriable: false,
      status: 400,
      errorType: 'BAD_REQUEST',
      message: 'Invalid argument',
    }, true);

    expect(cb.getStats().isProbing).toBe(false);
    expect(cb.getStats().lastErrorType).toBe('BAD_REQUEST');
    expect(cb.getStats().lastErrorStatus).toBe(400);

    // Next request can try probe
    const nextCheck = cb.canExecute(now + 60_002);
    expect(nextCheck.allowed).toBe(true);
    expect(nextCheck.isProbe).toBe(true);
  });

  it('calculates RPD cooldown correctly when 1 hour remains before UTC midnight (not 6 hours)', () => {
    const cb = new ModelCircuitBreaker('gemini-3.6-flash', {
      dailyQuotaCooldownMs: 6 * 3600 * 1000,
      jitter: false,
    });

    // 23:00 UTC = 1 hour before midnight
    const fixedNow = new Date('2026-11-07T23:00:00.000Z').getTime();
    cb.recordFailure(
      {
        isRetriable: true,
        errorType: 'RATE_LIMIT',
        message: 'Daily quota limit reached',
        isDailyQuota: true,
        quotaType: 'RPD',
      },
      false,
      fixedNow,
    );

    const expectedMidnight = new Date('2026-11-08T00:00:00.000Z').getTime();
    expect(cb.getStats().cooldownUntil).toBe(expectedMidnight);
    // Should be exactly 1 hour (3600s), NOT 6 hours
    expect(cb.getStats().cooldownUntil! - fixedNow).toBe(3600 * 1000);
  });
});
