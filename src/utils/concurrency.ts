/** Runs `fn` over items with at most `limit` in flight; preserves result order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return results;
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: {
    retries: number;
    baseDelayMs: number;
    shouldRetry: (err: unknown) => boolean;
    delayFor?: (err: unknown) => number | null;
  },
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= opts.retries || !opts.shouldRetry(err)) throw err;
      const custom = opts.delayFor?.(err) ?? null;
      const delay = custom ?? opts.baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 100);
      await sleep(Math.min(delay, 30000));
      attempt++;
    }
  }
}
