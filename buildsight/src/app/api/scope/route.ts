import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { scopeSchema } from "@/lib/api/schemas";
import { getCurrentUser } from "@/lib/auth/session";
import { runScope } from "@/server/scope";
import { getBuildForUser, toAssemblyInput } from "@/server/builds";

/**
 * POST /api/scope — the build assistant.
 *
 * Requests are policy-checked before anything else runs, so a restricted
 * request never reaches the search layer or the model adapter.
 */
export const POST = apiRoute(
  async (request) => {
    const body = scopeSchema.parse(await request.json());
    const user = await getCurrentUser();

    let assembly = null;
    if (body.buildId && user) {
      try {
        assembly = toAssemblyInput(await getBuildForUser(body.buildId, user.id));
      } catch {
        assembly = null;
      }
    }

    const reply = await runScope(body.message, assembly);
    return ok(reply);
  },
  { limit: { scope: "scope", limit: 30, windowMs: 60_000 } },
);
