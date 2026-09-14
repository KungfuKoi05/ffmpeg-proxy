/**
 * Structured errors. Customers see `publicMessage`; operators get `code`,
 * `detail`, and the cause in logs. Stack traces never cross the API boundary.
 */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "TENANT_MISMATCH"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "RATE_LIMITED"
  | "USAGE_LIMIT_REACHED"
  | "FEATURE_DISABLED"
  | "APPOINTMENT_CONFLICT"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_FAILURE"
  | "AI_FAILURE"
  | "CONFIG_MISSING"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  TENANT_MISMATCH: 403,
  WEBHOOK_SIGNATURE_INVALID: 403,
  RATE_LIMITED: 429,
  USAGE_LIMIT_REACHED: 402,
  FEATURE_DISABLED: 409,
  APPOINTMENT_CONFLICT: 409,
  UPSTREAM_TIMEOUT: 504,
  UPSTREAM_FAILURE: 502,
  AI_FAILURE: 502,
  CONFIG_MISSING: 500,
  INTERNAL: 500,
};

const PUBLIC_MESSAGE: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Please sign in to continue.",
  FORBIDDEN: "You do not have access to this resource.",
  NOT_FOUND: "Not found.",
  VALIDATION_FAILED: "Some of the submitted values are invalid.",
  TENANT_MISMATCH: "You do not have access to this resource.",
  WEBHOOK_SIGNATURE_INVALID: "Invalid signature.",
  RATE_LIMITED: "Too many requests. Please slow down.",
  USAGE_LIMIT_REACHED: "Usage limit reached. Upgrade or contact support.",
  FEATURE_DISABLED: "This feature is currently turned off.",
  APPOINTMENT_CONFLICT: "That time slot is no longer available.",
  UPSTREAM_TIMEOUT: "A third-party service timed out. Please retry.",
  UPSTREAM_FAILURE: "A third-party service is unavailable. Please retry.",
  AI_FAILURE: "The assistant is unavailable right now.",
  CONFIG_MISSING: "Service is not fully configured.",
  INTERNAL: "Something went wrong on our end.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly publicMessage: string;
  readonly detail?: unknown;

  constructor(code: ErrorCode, detail?: unknown, cause?: unknown) {
    super(`${code}${detail ? `: ${JSON.stringify(detail)}` : ""}`);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.publicMessage = PUBLIC_MESSAGE[code];
    this.detail = detail;
    if (cause !== undefined) this.cause = cause;
  }
}

/** Body shape returned to clients. Deliberately free of internals. */
export function toPublicError(err: unknown): {
  body: { error: { code: ErrorCode; message: string } };
  status: number;
} {
  const e = err instanceof AppError ? err : new AppError("INTERNAL", undefined, err);
  if (!(err instanceof AppError)) {
    console.error("[unhandled]", err instanceof Error ? err.stack : err);
  }
  return {
    body: { error: { code: e.code, message: e.publicMessage } },
    status: e.status,
  };
}

/** Wrap a promise with a timeout so an external call cannot hang a request. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new AppError("UPSTREAM_TIMEOUT", { label, ms })),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Retry with exponential backoff. Only retries what the predicate allows. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; retryOn?: (e: unknown) => boolean } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 250;
  const retryOn = opts.retryOn ?? (() => true);
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i === attempts - 1 || !retryOn(err)) break;
      await new Promise((r) => setTimeout(r, base * 2 ** i));
    }
  }
  throw lastError;
}
