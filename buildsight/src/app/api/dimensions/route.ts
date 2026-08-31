import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { evaluateSchema } from "@/lib/api/schemas";
import { computeDimensions } from "@/lib/dimensions/engine";
import { assemblyFromRequest } from "@/server/assembly";

/** POST /api/dimensions — clearance and overall-length report for a set. */
export const POST = apiRoute(async (request) => {
  const body = evaluateSchema.parse(await request.json());
  const assembly = await assemblyFromRequest(body);
  return ok({ dimensions: computeDimensions(assembly) });
});
