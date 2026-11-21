import { NetworkError } from '../../core/errors.js';
import type { ForgeConfig } from '../../core/config.js';
import { withRetry } from '../../utils/concurrency.js';

export interface HttpClient {
  getText(url: string): Promise<string>;
}

/** Thin HTTP layer: timeout, bounded retry on transient failures (network, 408, 429, 5xx), honors Retry-After. */
export function createHttpClient(fetchImpl: typeof fetch, network: ForgeConfig['network']): HttpClient {
  async function once(url: string): Promise<string> {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        signal: AbortSignal.timeout(network.timeoutMs),
        headers: { 'user-agent': 'iconforge/1.0 (+local CLI)', accept: '*/*' },
        redirect: 'follow',
      });
    } catch (err) {
      const timeout = (err as Error).name === 'TimeoutError' || (err as Error).name === 'AbortError';
      throw new NetworkError(timeout ? `Timeout after ${network.timeoutMs}ms: ${url}` : `Network error for ${url}: ${(err as Error).message}`, {
        retryable: true,
        cause: err,
      });
    }
    if (!res.ok) {
      const retryAfter = Number(res.headers.get('retry-after'));
      throw new NetworkError(`HTTP ${res.status} for ${url}`, {
        status: res.status,
        retryable: res.status === 408 || res.status === 429 || res.status >= 500,
        retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null,
      });
    }
    return await res.text();
  }

  return {
    getText: (url) =>
      withRetry(() => once(url), {
        retries: network.retries,
        baseDelayMs: network.retryBaseDelayMs,
        shouldRetry: (e) => e instanceof NetworkError && e.retryable,
        delayFor: (e) => (e instanceof NetworkError ? e.retryAfterMs : null),
      }),
  };
}
