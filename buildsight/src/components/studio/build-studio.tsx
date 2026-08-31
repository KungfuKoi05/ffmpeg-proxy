"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Box,
  Camera,
  Eye,
  EyeOff,
  Grid3x3,
  Layers,
  RotateCcw,
  Ruler,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ComponentLibrary, type LibraryCategory } from "@/components/studio/component-library";
import { Inspector } from "@/components/studio/inspector";
import { SummaryBar } from "@/components/studio/summary-bar";
import { ScopePanel } from "@/components/studio/scope-panel";
import {
  TechnicalView,
  type TechnicalViewMode,
} from "@/components/studio/technical-view";
import type { ViewerApi, ViewerMode } from "@/components/studio/viewer-3d";
import { summarizeBuild } from "@/lib/build/summary";
import { placeAssembly } from "@/lib/assembly/geometry";
import { slotForCategory, SLOTS } from "@/lib/assembly/slots";
import { SIGNAL_FOR_COMPATIBILITY } from "@/components/ui/signal";
import { cn } from "@/lib/utils";
import type { SerializedProduct } from "@/server/serializers";
import type {
  AssemblyComponent,
  CompatibilityRuleInput,
  CompatibilityState,
  SignalState,
} from "@/lib/types";

// The 3D viewer pulls in three.js, so it is loaded on demand and never during
// server rendering.
const Viewer3D = dynamic(
  () => import("@/components/studio/viewer-3d").then((module) => module.Viewer3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
          Loading viewport…
        </p>
      </div>
    ),
  },
);

export interface StudioBuild {
  id: string | null;
  name: string;
  description: string | null;
  platform: string | null;
  caliber: string | null;
}

type MobilePanel = "library" | "viewport" | "inspector";

export function BuildStudio({
  build: initialBuild,
  initialComponents,
  rules,
  catalog,
  categories,
  canSave,
}: {
  build: StudioBuild;
  initialComponents: AssemblyComponent[];
  rules: CompatibilityRuleInput[];
  catalog: SerializedProduct[];
  categories: LibraryCategory[];
  canSave: boolean;
}) {
  const router = useRouter();
  const [build, setBuild] = useState(initialBuild);
  const [components, setComponents] = useState<AssemblyComponent[]>(initialComponents);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<ViewerMode>("solid");
  const [technicalMode, setTechnicalMode] = useState<TechnicalViewMode>("side");
  const [view, setView] = useState<"3d" | "2d">("3d");
  const [showGrid, setShowGrid] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [hiddenSlots, setHiddenSlots] = useState<string[]>([]);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("viewport");
  const viewerRef = useRef<ViewerApi | null>(null);

  const assembly = useMemo(
    () => ({ platform: build.platform, components }),
    [build.platform, components],
  );

  // The engines are pure, so the studio recomputes locally on every change and
  // the server stays authoritative on save.
  const summary = useMemo(() => summarizeBuild(assembly, rules), [assembly, rules]);
  const parts = useMemo(() => placeAssembly(components), [components]);

  const signals = useMemo(() => {
    const map: Record<string, SignalState> = {};
    const worst: Record<string, CompatibilityState> = {};
    for (const finding of summary.compatibility.findings) {
      for (const id of [finding.subjectProductId, finding.targetProductId]) {
        if (!id) continue;
        const current = worst[id];
        const severity: Record<CompatibilityState, number> = {
          INCOMPATIBLE: 4,
          CONDITIONAL: 3,
          UNKNOWN: 2,
          COMPATIBLE: 1,
        };
        if (!current || severity[finding.state] > severity[current]) worst[id] = finding.state;
      }
    }
    for (const [id, state] of Object.entries(worst)) map[id] = SIGNAL_FOR_COMPATIBILITY[state];
    return map;
  }, [summary]);

  const addProduct = useCallback(
    async (product: SerializedProduct) => {
      const slotKey = slotForCategory(product.categorySlug)?.key;
      if (!slotKey) {
        setNotice(`${product.categoryName} has no assembly slot in this platform.`);
        return;
      }

      setBusyProductId(product.id);
      setComponents((current) => {
        const singleOccupancy = !["accessory", "sling-hardware", "light"].includes(slotKey);
        const filtered = singleOccupancy
          ? current.filter((component) => component.slotKey !== slotKey)
          : current.filter((component) => component.product.id !== product.id);
        return [...filtered, { slotKey, quantity: 1, product }];
      });
      setSelectedProductId(product.id);
      setDirty(true);

      if (build.id) {
        try {
          const response = await fetch(`/api/builds/${build.id}/components`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ productId: product.id, slotKey }),
          });
          if (!response.ok) {
            const payload = (await response.json()) as { error?: { message: string } };
            setNotice(payload.error?.message ?? "Could not save that component.");
          } else {
            setDirty(false);
          }
        } catch {
          setNotice("Offline — the component was added locally but not saved.");
        }
      }
      setBusyProductId(null);
    },
    [build.id],
  );

  const removeProduct = useCallback(
    async (productId: string) => {
      setBusyProductId(productId);
      setComponents((current) => current.filter((component) => component.product.id !== productId));
      if (selectedProductId === productId) setSelectedProductId(null);
      setDirty(true);

      if (build.id) {
        try {
          const response = await fetch(`/api/builds/${build.id}`);
          if (response.ok) {
            const payload = (await response.json()) as {
              build: { components: Array<{ id: string; productId: string }> };
            };
            const match = payload.build.components.find(
              (component) => component.productId === productId,
            );
            if (match) {
              await fetch(`/api/builds/${build.id}/components/${match.id}`, { method: "DELETE" });
              setDirty(false);
            }
          }
        } catch {
          setNotice("Offline — the component was removed locally but not saved.");
        }
      }
      setBusyProductId(null);
    },
    [build.id, selectedProductId],
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      if (build.id) {
        const response = await fetch(`/api/builds/${build.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: build.name, description: build.description }),
        });
        if (!response.ok) {
          const payload = (await response.json()) as { error?: { message: string } };
          setNotice(payload.error?.message ?? "Could not save the configuration.");
          return;
        }
        setDirty(false);
        setNotice("Configuration saved.");
      } else {
        const response = await fetch("/api/builds", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: build.name || "Untitled configuration",
            platform: build.platform ?? undefined,
            caliber: build.caliber ?? undefined,
            components: components.map((component) => ({
              productId: component.product.id,
              slotKey: component.slotKey,
              quantity: component.quantity,
            })),
          }),
        });
        const payload = (await response.json()) as {
          build?: { id: string };
          error?: { message: string };
        };
        if (!response.ok || !payload.build) {
          setNotice(payload.error?.message ?? "Could not create the configuration.");
          return;
        }
        setBuild((current) => ({ ...current, id: payload.build!.id }));
        setDirty(false);
        router.push(`/studio/${payload.build.id}`);
      }
    } finally {
      setSaving(false);
    }
  }, [build, components, router]);

  const duplicate = useCallback(async () => {
    if (!build.id) return;
    const response = await fetch(`/api/builds/${build.id}/duplicate`, { method: "POST" });
    const payload = (await response.json()) as {
      build?: { id: string };
      error?: { message: string };
    };
    if (!response.ok || !payload.build) {
      setNotice(payload.error?.message ?? "Could not duplicate the configuration.");
      return;
    }
    router.push(`/studio/${payload.build.id}`);
  }, [build.id, router]);

  const screenshot = useCallback(() => {
    const dataUrl = viewerRef.current?.screenshot();
    if (!dataUrl) {
      setNotice("The viewport could not be captured in this browser.");
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${(build.name || "configuration").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    link.click();
  }, [build.name]);

  const occupiedSlots = SLOTS.filter((slot) =>
    components.some((component) => component.slotKey === slot.key),
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {notice ? (
        <div className="flex items-center justify-between gap-3 border-b border-accent/40 bg-accent/10 px-4 py-2 text-xs text-accent">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-[11px] underline">
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Mobile panel switcher */}
      <div className="flex border-b border-line lg:hidden">
        {(["library", "viewport", "inspector"] as MobilePanel[]).map((panel) => (
          <button
            key={panel}
            type="button"
            onClick={() => setMobilePanel(panel)}
            className={cn(
              "flex-1 border-b-2 py-2 font-mono text-[10px] uppercase tracking-wider",
              mobilePanel === panel
                ? "border-accent text-ink"
                : "border-transparent text-ink-faint",
            )}
          >
            {panel}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
        <aside
          className={cn(
            "min-h-0 border-r border-line lg:block",
            mobilePanel === "library" ? "block" : "hidden",
          )}
        >
          <ComponentLibrary
            categories={categories}
            initialProducts={catalog}
            components={components}
            rules={rules}
            platform={build.platform}
            onAdd={addProduct}
            busyProductId={busyProductId}
          />
        </aside>

        <section
          className={cn(
            "flex min-h-0 flex-col lg:flex",
            mobilePanel === "viewport" ? "flex" : "hidden",
          )}
        >
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-elevated/60 px-3 py-2">
            <Input
              value={build.name}
              onChange={(event) => {
                setBuild((current) => ({ ...current, name: event.target.value }));
                setDirty(true);
              }}
              className="h-8 w-48 border-transparent bg-transparent px-2 text-sm font-medium hover:border-line"
              aria-label="Configuration name"
            />
            <div className="mx-1 h-5 w-px bg-line" />

            <ToolbarToggle active={view === "3d"} onClick={() => setView("3d")} label="3D">
              <Box />
            </ToolbarToggle>
            <ToolbarToggle active={view === "2d"} onClick={() => setView("2d")} label="2D">
              <Layers />
            </ToolbarToggle>

            <div className="mx-1 h-5 w-px bg-line" />

            {view === "3d" ? (
              <>
                {(["solid", "exploded", "xray", "measure"] as ViewerMode[]).map((mode) => (
                  <ToolbarToggle
                    key={mode}
                    active={viewerMode === mode}
                    onClick={() => setViewerMode(mode)}
                    label={mode}
                  >
                    {mode === "measure" ? <Ruler /> : mode === "xray" ? <Eye /> : <Box />}
                  </ToolbarToggle>
                ))}
                <ToolbarToggle active={showGrid} onClick={() => setShowGrid((v) => !v)} label="Grid">
                  <Grid3x3 />
                </ToolbarToggle>
                <ToolbarToggle
                  active={false}
                  onClick={() => viewerRef.current?.resetView()}
                  label="Reset"
                >
                  <RotateCcw />
                </ToolbarToggle>
                <ToolbarToggle active={false} onClick={screenshot} label="Capture">
                  <Camera />
                </ToolbarToggle>
              </>
            ) : (
              <>
                {(["side", "top", "front", "section"] as TechnicalViewMode[]).map((mode) => (
                  <ToolbarToggle
                    key={mode}
                    active={technicalMode === mode}
                    onClick={() => setTechnicalMode(mode)}
                    label={mode}
                  >
                    <Layers />
                  </ToolbarToggle>
                ))}
                <ToolbarToggle
                  active={showMeasurements}
                  onClick={() => setShowMeasurements((v) => !v)}
                  label="Dimensions"
                >
                  <Ruler />
                </ToolbarToggle>
              </>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              <Badge tone="yellow" title="Geometry is generated from published dimensions and is not an engineering model.">
                Visual approximation
              </Badge>
              <Button
                size="sm"
                variant={scopeOpen ? "primary" : "secondary"}
                onClick={() => setScopeOpen((value) => !value)}
              >
                <Sparkles /> SCOPE
              </Button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 bg-base">
            {components.length === 0 ? (
              <div className="tech-grid absolute inset-0 flex items-center justify-center opacity-100">
                <div className="max-w-sm rounded-panel border border-line bg-surface/90 p-5 text-center">
                  <p className="text-sm font-medium">Start your configuration</p>
                  <p className="mt-1.5 text-xs text-ink-muted">
                    Add a receiver and a barrel from the component library. Compatibility,
                    clearance, cost and weight update as you go.
                  </p>
                </div>
              </div>
            ) : view === "3d" ? (
              <Viewer3D
                parts={parts}
                mode={viewerMode}
                showGrid={showGrid}
                hiddenSlots={hiddenSlots}
                selectedProductId={selectedProductId}
                signals={signals}
                onSelect={setSelectedProductId}
                onReady={(api) => {
                  viewerRef.current = api;
                }}
              />
            ) : (
              <div className="tech-grid-fine h-full p-4 text-ink">
                <TechnicalView
                  parts={parts.filter((part) => !hiddenSlots.includes(part.slotKey))}
                  mode={technicalMode}
                  showMeasurements={showMeasurements}
                  selectedProductId={selectedProductId}
                  onSelect={setSelectedProductId}
                />
              </div>
            )}

            {occupiedSlots.length > 0 ? (
              <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1">
                {occupiedSlots.map((slot) => {
                  const hidden = hiddenSlots.includes(slot.key);
                  return (
                    <button
                      key={slot.key}
                      type="button"
                      onClick={() =>
                        setHiddenSlots((current) =>
                          hidden
                            ? current.filter((key) => key !== slot.key)
                            : [...current, slot.key],
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
                        hidden
                          ? "border-line bg-base/80 text-ink-faint"
                          : "border-line-strong bg-surface/90 text-ink-muted hover:text-ink",
                      )}
                      title={hidden ? `Show ${slot.label}` : `Hide ${slot.label}`}
                    >
                      {hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <aside
          className={cn(
            "min-h-0 border-l border-line lg:block",
            mobilePanel === "inspector" ? "block" : "hidden",
          )}
        >
          {scopeOpen ? (
            <ScopePanel
              buildId={build.id}
              onAdd={addProduct}
              onClose={() => setScopeOpen(false)}
            />
          ) : (
            <Inspector
              summary={summary}
              components={components}
              selectedProductId={selectedProductId}
              onSelect={setSelectedProductId}
              onRemove={removeProduct}
              busyProductId={busyProductId}
            />
          )}
        </aside>
      </div>

      <SummaryBar
        summary={summary}
        buildId={build.id}
        canSave={canSave}
        saving={saving}
        dirty={dirty}
        onSave={save}
        onDuplicate={duplicate}
      />
    </div>
  );
}

function ToolbarToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded border px-2 font-mono text-[10px] uppercase tracking-wider transition-colors [&_svg]:size-3",
        active
          ? "border-accent/50 bg-accent/15 text-accent"
          : "border-line bg-base text-ink-faint hover:border-line-strong hover:text-ink-muted",
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
