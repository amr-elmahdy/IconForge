import type { IconError, Stage } from './types.js';

export class ForgeError extends Error {
  readonly code: string;
  readonly stage: Stage;
  readonly icon: string | null;
  readonly variant: string | null;
  readonly recoverable: boolean;

  constructor(opts: {
    code: string;
    stage: Stage;
    message: string;
    icon?: string | null;
    variant?: string | null;
    recoverable?: boolean;
    cause?: unknown;
  }) {
    super(opts.message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'ForgeError';
    this.code = opts.code;
    this.stage = opts.stage;
    this.icon = opts.icon ?? null;
    this.variant = opts.variant ?? null;
    this.recoverable = opts.recoverable ?? true;
  }

  toRecord(): IconError {
    return {
      code: this.code,
      stage: this.stage,
      icon: this.icon,
      variant: this.variant,
      message: this.message,
      recoverable: this.recoverable,
    };
  }
}

export class NetworkError extends ForgeError {
  readonly status: number | null;
  readonly retryable: boolean;
  readonly retryAfterMs: number | null;
  constructor(
    message: string,
    opts: { status?: number | null; retryable: boolean; stage?: Stage; cause?: unknown; retryAfterMs?: number | null },
  ) {
    super({
      code: opts.status ? `HTTP_${opts.status}` : 'NETWORK',
      stage: opts.stage ?? 'download',
      message,
      cause: opts.cause,
    });
    this.name = 'NetworkError';
    this.status = opts.status ?? null;
    this.retryable = opts.retryable;
    this.retryAfterMs = opts.retryAfterMs ?? null;
  }
}

export function toForgeError(err: unknown, fallback: { stage: Stage; icon?: string | null; variant?: string | null }): ForgeError {
  if (err instanceof ForgeError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new ForgeError({
    code: 'UNEXPECTED',
    stage: fallback.stage,
    icon: fallback.icon ?? null,
    variant: fallback.variant ?? null,
    message,
    recoverable: true,
    cause: err,
  });
}
