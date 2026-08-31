import { apiRoute } from "@/lib/api/handler";
import { ok, apiError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { runPriceCheck } from "@/server/price-monitor";
import { writeAuditLog, requestIp } from "@/lib/audit";

/**
 * POST /api/jobs/price-check — run the watchlist price monitor.
 *
 * Callable by an administrator from the admin dashboard, or by a scheduler
 * presenting `x-job-token`. Anything else is rejected.
 */
export const POST = apiRoute(
  async (request) => {
    const token = request.headers.get("x-job-token");
    const expected = process.env.JOBS_TOKEN;
    const user = await getCurrentUser();
    const isScheduler = Boolean(expected && token && token === expected);

    if (!isScheduler && user?.role !== "ADMIN") {
      return apiError("FORBIDDEN", "Administrator role or a valid job token is required.", 403);
    }

    const result = await runPriceCheck();
    await writeAuditLog({
      actorId: user?.id ?? null,
      action: "jobs.price_check",
      entityType: "System",
      after: result,
      ip: requestIp(request),
    });

    return ok(result);
  },
  // A scheduler calls this cross-origin with a token rather than a cookie, so
  // the same-origin guard is skipped in favour of the token check above.
  { mutating: false, limit: { scope: "jobs", limit: 20, windowMs: 60_000 } },
);
