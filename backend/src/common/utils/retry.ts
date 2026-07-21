export interface RetryOptions {
  maxRetries: number;
  baseMs: number;
  maxMs: number;
  label?: string;
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === opts.maxRetries) break;
      const exp = Math.min(opts.maxMs, opts.baseMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * Math.min(250, exp * 0.2));
      const delayMs = exp + jitter;
      opts.onRetry?.(attempt + 1, err, delayMs);
      await sleep(delayMs);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? `${opts.label ?? "operation"} failed`));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
