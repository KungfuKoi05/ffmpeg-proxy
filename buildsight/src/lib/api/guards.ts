import { apiError } from "@/lib/api/response";
import { clientKey, rateLimit, rateLimitResponseHeaders } from "@/lib/api/rate-limit";

/**
 * Same-origin check for state-changing requests.
 *
 * The session cookie is SameSite=Lax, which already blocks cross-site form
 * posts; this is the belt-and-braces check for fetch-based requests that carry
 * an Origin header.
 */
export function assertSameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const origin = request.headers.get("origin");
  if (!origin) return; // Same-origin fetches from server components send none.

  const host = request.headers.get("host");
  const allowed = new Set<string>();
  if (host) {
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }
  if (process.env.NEXT_PUBLIC_APP_URL) allowed.add(process.env.NEXT_PUBLIC_APP_URL);

  if (!allowed.has(origin)) {
    throw new CrossOriginError(`Cross-origin request rejected from ${origin}.`);
  }
}

export class CrossOriginError extends Error {
  readonly status = 403;
}

export interface LimitOptions {
  scope: string;
  limit: number;
  windowMs: number;
}

/** Returns a 429 response when the caller is over budget, else null. */
export function enforceRateLimit(request: Request, options: LimitOptions) {
  const result = rateLimit(clientKey(request, options.scope), options.limit, options.windowMs);
  if (result.ok) return null;
  const response = apiError(
    "RATE_LIMITED",
    "Too many requests. Try again shortly.",
    429,
  );
  for (const [header, value] of Object.entries(rateLimitResponseHeaders(result))) {
    response.headers.set(header, value);
  }
  return response;
}
