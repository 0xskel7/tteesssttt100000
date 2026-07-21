/**
 * Circuit Breaker — copied/shared pattern with realtime-engine.
 * Backend keeps its own copy so the API process does not import the engine package.
 */
export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  openMs: number;
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private openedAt = 0;

  constructor(private readonly opts: CircuitBreakerOptions) {}

  getState(): CircuitState {
    this.maybeHalfOpen();
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeHalfOpen();
    if (this.state === "open") {
      throw new CircuitOpenError(this.opts.name ?? "circuit");
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private maybeHalfOpen(): void {
    if (this.state === "open" && Date.now() - this.openedAt >= this.opts.openMs) {
      this.state = "half_open";
      this.successes = 0;
    }
  }

  private onSuccess(): void {
    if (this.state === "half_open") {
      this.successes += 1;
      if (this.successes >= this.opts.successThreshold) {
        this.state = "closed";
        this.failures = 0;
      }
      return;
    }
    this.failures = 0;
  }

  private onFailure(): void {
    this.failures += 1;
    if (
      this.state === "half_open" ||
      this.failures >= this.opts.failureThreshold
    ) {
      this.state = "open";
      this.openedAt = Date.now();
      this.successes = 0;
    }
  }
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker open: ${name}`);
    this.name = "CircuitOpenError";
  }
}
