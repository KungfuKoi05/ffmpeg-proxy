"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CompatibilityBadge, VerificationBadge } from "@/components/ui/signal";
import { PanelHeading, DemoTag } from "@/components/ui/misc";
import { formatLength, formatMass, formatMoney, NOT_PROVIDED } from "@/lib/units";
import { evaluateCompatibility, worseState } from "@/lib/compatibility/engine";
import { slotForCategory } from "@/lib/assembly/slots";
import { cn } from "@/lib/utils";
import type { SerializedProduct } from "@/server/serializers";
import type { AssemblyComponent, CompatibilityRuleInput, CompatibilityState } from "@/lib/types";

export interface LibraryCategory {
  slug: string;
  name: string;
  productCount: number;
}

/**
 * Left panel: searchable component library.
 *
 * Each candidate is checked against the current configuration with the same
 * rules engine the inspector uses, so the badge shown before adding a part is
 * the badge the build will report afterwards.
 */
export function ComponentLibrary({
  categories,
  initialProducts,
  components,
  rules,
  platform,
  onAdd,
  busyProductId,
}: {
  categories: LibraryCategory[];
  initialProducts: SerializedProduct[];
  components: AssemblyComponent[];
  rules: CompatibilityRuleInput[];
  platform: string | null;
  onAdd: (product: SerializedProduct) => void;
  busyProductId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [remoteProducts, setRemoteProducts] = useState<SerializedProduct[] | null>(null);
  const [loading, setLoading] = useState(false);

  const filtersActive = Boolean(query || category);
  // With no filters the panel renders the server-provided page directly, so no
  // effect has to copy props into state.
  const products = useMemo(
    () => (filtersActive ? (remoteProducts ?? []) : initialProducts),
    [filtersActive, remoteProducts, initialProducts],
  );

  useEffect(() => {
    if (!query && !category) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "40" });
        if (query) params.set("q", query);
        if (category) params.set("category", category);
        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { products: SerializedProduct[] };
        setRemoteProducts(payload.products);
      } catch {
        // Aborted or offline: keep whatever is on screen.
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, category]);

  // Pre-compute the outcome of adding each candidate to the configuration.
  const candidateStates = useMemo(() => {
    if (components.length === 0) return new Map<string, CompatibilityState>();
    const states = new Map<string, CompatibilityState>();
    for (const product of products) {
      const slotKey = slotForCategory(product.categorySlug)?.key;
      if (!slotKey) continue;
      const rest = components.filter((component) => component.slotKey !== slotKey);
      const report = evaluateCompatibility(
        { platform, components: [...rest, { slotKey, quantity: 1, product }] },
        rules,
      );
      const related = report.findings.filter(
        (finding) =>
          finding.subjectProductId === product.id || finding.targetProductId === product.id,
      );
      states.set(
        product.id,
        related.length === 0
          ? "UNKNOWN"
          : related.reduce<CompatibilityState>(
              (worst, finding) => worseState(worst, finding.state),
              "COMPATIBLE",
            ),
      );
    }
    return states;
  }, [products, components, rules, platform]);

  const installedIds = new Set(components.map((component) => component.product.id));

  return (
    <div className="flex h-full flex-col bg-surface">
      <PanelHeading
        title="Component library"
        action={
          loading ? <Loader2 className="size-3.5 animate-spin text-ink-faint" /> : null
        }
      />
      <div className="space-y-2 border-b border-line p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search parts, part numbers, 11.5 barrel…"
            className="pl-8"
            aria-label="Search the component library"
          />
        </div>
        <Select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name} ({item.productCount})
            </option>
          ))}
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {products.length === 0 ? (
          <p className="p-4 text-xs text-ink-muted">
            No catalog records match. Try a broader search — results come from published catalog
            data only.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {products.map((product) => {
              const state = candidateStates.get(product.id);
              const installed = installedIds.has(product.id);
              const price = product.currentPriceCents ?? product.msrpCents;
              return (
                <li
                  key={product.id}
                  className={cn(
                    "group p-3 transition-colors hover:bg-elevated",
                    installed && "bg-elevated/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-ink" title={product.productName}>
                        {product.productName}
                      </p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {product.manufacturerName}
                      </p>
                    </div>
                    <Button
                      size="icon-sm"
                      variant={installed ? "ghost" : "secondary"}
                      onClick={() => onAdd(product)}
                      disabled={busyProductId === product.id}
                      aria-label={`Add ${product.productName} to the configuration`}
                      title={installed ? "Already in this configuration" : "Add to configuration"}
                    >
                      {busyProductId === product.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Plus />
                      )}
                    </Button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {product.isDemo ? <DemoTag /> : null}
                    <VerificationBadge status={product.verificationStatus} />
                    {state ? <CompatibilityBadge state={state} /> : null}
                  </div>

                  <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px] text-ink-faint">
                    <div>
                      <dt className="uppercase tracking-wider">Len</dt>
                      <dd className="text-ink-muted" title={product.lengthMm === null ? NOT_PROVIDED : undefined}>
                        {product.lengthMm === null ? "—" : formatLength(product.lengthMm)}
                      </dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wider">Mass</dt>
                      <dd className="text-ink-muted">
                        {product.weightGrams === null ? "—" : formatMass(product.weightGrams)}
                      </dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wider">Price</dt>
                      <dd className="text-ink-muted">
                        {price === null ? "—" : formatMoney(price, product.currency, { showCents: false })}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
