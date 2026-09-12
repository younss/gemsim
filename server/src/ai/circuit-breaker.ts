// ============================================================================
// GEMSIM: AI CIRCUIT BREAKER PATTERN
// Prevents cascade failures when LLM providers fail or timeout.
// 3 consecutive failures -> trips into OPEN state for 60s cooldown.
// ============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // default: 3
  cooldownMs?: number;       // default: 60,000 (60s)
  name?: string;
}

export class CircuitBreakerOpenError extends Error {
  public readonly remainingSeconds: number;
  public readonly providerName: string;

  constructor(providerName: string, remainingSeconds: number) {
    super(
      `Circuit breaker actif pour '${providerName}' (3 échecs consécutifs). En pause de sécurité : réessayez dans ${remainingSeconds}s (réessayez dans 1 min).`
    );
    this.name = 'CircuitBreakerOpenError';
    this.remainingSeconds = remainingSeconds;
    this.providerName = providerName;
  }
}

export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  private state: CircuitState = 'CLOSED';
  private consecutiveFailures: number = 0;
  private lastFailureTime: number = 0;
  private successfulProbes: number = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.name = options.name || 'AI-Service';
    this.failureThreshold = options.failureThreshold || 3;
    this.cooldownMs = options.cooldownMs || 60000; // 60s
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.cooldownMs) {
        this.state = 'HALF_OPEN';
        this.successfulProbes = 0;
      }
    }
    return this.state;
  }

  public getRemainingCooldownSeconds(): number {
    if (this.state !== 'OPEN') return 0;
    const elapsed = Date.now() - this.lastFailureTime;
    const remaining = Math.max(0, this.cooldownMs - elapsed);
    return Math.ceil(remaining / 1000);
  }

  public getStatus() {
    return {
      name: this.name,
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      remainingCooldownSeconds: this.getRemainingCooldownSeconds(),
    };
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      const remainingSec = this.getRemainingCooldownSeconds();
      throw new CircuitBreakerOpenError(this.name, remainingSec);
    }

    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (err: any) {
      this.recordFailure(err);
      throw err;
    }
  }

  public recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successfulProbes++;
      if (this.successfulProbes >= 1) {
        console.log(`[CircuitBreaker] '${this.name}' recovered from HALF_OPEN to CLOSED.`);
        this.state = 'CLOSED';
        this.consecutiveFailures = 0;
      }
    } else {
      this.consecutiveFailures = 0;
    }
  }

  public recordFailure(err?: any) {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    console.warn(
      `[CircuitBreaker] '${this.name}' recorded failure (${this.consecutiveFailures}/${this.failureThreshold}): ${err?.message || err}`
    );

    if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.error(
        `[CircuitBreaker] TRIPPED: '${this.name}' is now OPEN for ${this.cooldownMs / 1000}s pause.`
      );
    }
  }

  public reset() {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }
}
