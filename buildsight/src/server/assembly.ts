import { getProductsByIds, toProductFacts } from "@/server/products";
import { slotForCategory } from "@/lib/assembly/slots";
import type { AssemblyComponent, AssemblyInput } from "@/lib/types";

export interface AssemblyRequest {
  platform?: string | null;
  components: Array<{ productId: string; slotKey?: string; quantity?: number }>;
}

/**
 * Resolve an API payload of product ids into a fully hydrated assembly.
 * Unknown product ids are dropped rather than failing the whole request, so a
 * stale client cannot lock a user out of evaluating the rest of their build.
 */
export async function assemblyFromRequest(request: AssemblyRequest): Promise<AssemblyInput> {
  const products = await getProductsByIds(request.components.map((c) => c.productId));
  const byId = new Map(products.map((product) => [product.id, product]));

  const components: AssemblyComponent[] = [];
  for (const entry of request.components) {
    const product = byId.get(entry.productId);
    if (!product) continue;
    const facts = toProductFacts(product);
    const slotKey = entry.slotKey ?? slotForCategory(facts.categorySlug)?.key;
    if (!slotKey) continue;
    components.push({ slotKey, quantity: entry.quantity ?? 1, product: facts });
  }

  return { platform: request.platform ?? null, components };
}
