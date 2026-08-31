import { handleApiError, apiError } from "@/lib/api/response";
import { assertSameOrigin, enforceRateLimit, CrossOriginError, type LimitOptions } from "@/lib/api/guards";

export interface RouteContext<P = Record<string, string>> {
  params: Promise<P>;
}

export interface ApiRouteOptions {
  /** Enforces the same-origin check. Defaults to true for non-GET methods. */
  mutating?: boolean;
  limit?: LimitOptions;
}

type Handler<P> = (request: Request, context: RouteContext<P>) => Promise<Response>;

const DEFAULT_READ_LIMIT: LimitOptions = { scope: "api-read", limit: 300, windowMs: 60_000 };
const DEFAULT_WRITE_LIMIT: LimitOptions = { scope: "api-write", limit: 60, windowMs: 60_000 };

/**
 * Wraps a route handler with the cross-cutting concerns every endpoint needs:
 * rate limiting, the same-origin check for mutations, and error normalisation.
 */
export function apiRoute<P = Record<string, string>>(
  handler: Handler<P>,
  options: ApiRouteOptions = {},
): Handler<P> {
  return async (request, context) => {
    try {
      const method = request.method.toUpperCase();
      const mutating = options.mutating ?? method !== "GET";
      if (mutating) assertSameOrigin(request);

      const limited = enforceRateLimit(
        request,
        options.limit ?? (mutating ? DEFAULT_WRITE_LIMIT : DEFAULT_READ_LIMIT),
      );
      if (limited) return limited;

      return await handler(request, context);
    } catch (error) {
      if (error instanceof CrossOriginError) {
        return apiError("CROSS_ORIGIN", error.message, 403);
      }
      return handleApiError(error);
    }
  };
}

export function searchParams(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

export function numberParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}
