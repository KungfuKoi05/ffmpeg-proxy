import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { evaluateSchema } from "@/lib/api/schemas";
import { evaluateCompatibility } from "@/lib/compatibility/engine";
import { loadActiveRules } from "@/server/rules";
import { assemblyFromRequest } from "@/server/assembly";

/**
 * POST /api/compatibility — evaluate a component set.
 *
 * The engine result is returned verbatim, including UNKNOWN findings; the
 * caller never receives a "probably fine" upgrade.
 */
export const POST = apiRoute(async (request) => {
  const body = evaluateSchema.parse(await request.json());
  const [assembly, rules] = await Promise.all([
    assemblyFromRequest(body),
    loadActiveRules(),
  ]);
  return ok({ compatibility: evaluateCompatibility(assembly, rules) });
});
