import { logger } from '../lib/logger';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  resetTimeoutMs?: number;
  name?: string;
}

/** Classic circuit breaker: open after N consecutive failures, half-open probe after timeout. */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private openedAt = 0;
  private readonly opts: Required<CircuitBreakerOptions>;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.opts = {
      failureThreshold: opts.failureThreshold ?? 5,
      successThreshold: opts.successThreshold ?? 2,
      resetTimeoutMs: opts.resetTimeoutMs ?? 30_000,
      name: opts.name ?? 'circuit',
    };
  }

  getState(): CircuitState {
    if (this.state === 'open' && Date.now() - this.openedAt >= this.opts.resetTimeoutMs) {
      this.state = 'half-open';
      this.successes = 0;
    }
    return this.state;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === 'open') throw new Error(`circuit-breaker-open:${this.opts.name}`);
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === 'half-open') {
      this.successes += 1;
      if (this.successes >= this.opts.successThreshold) {
        this.state = 'closed';
        logger.info({ breaker: this.opts.name }, 'circuit breaker closed');
      }
    }
  }

  private onFailure(): void {
    this.failures += 1;
    if (this.failures >= this.opts.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
      logger.warn({ breaker: this.opts.name, failures: this.failures }, 'circuit breaker opened');
    }
  }
}

/** One breaker per provider so a single outage does not take down the gateway. */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  get(name: string): CircuitBreaker {
    let b = this.breakers.get(name);
    if (!b) { b = new CircuitBreaker({ name }); this.breakers.set(name, b); }
    return b;
  }
  states(): Record<string, CircuitState> {
    return Object.fromEntries([...this.breakers.entries()].map(([k, v]) => [k, v.getState()]));
  }
}
export const circuitBreakers = new CircuitBreakerRegistry();
