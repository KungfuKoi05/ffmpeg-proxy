/**
 * Placement geometry for the visualizers.
 *
 * Shapes are simplified primitives sized from published dimensions. Wherever a
 * dimension is missing a neutral placeholder size is substituted and recorded
 * in `defaultedDimensions`, so the viewer can label the part as a VISUAL
 * APPROXIMATION instead of implying an engineering model.
 */

import { SLOT_BY_KEY, slotLabel } from "@/lib/assembly/slots";
import { layoutAssembly } from "@/lib/dimensions/engine";
import { getDimensionMm } from "@/lib/dimensions/access";
import type { AssemblyComponent } from "@/lib/types";

export type PartShape = "cylinder" | "tube" | "box";

export interface PlacedPart {
  productId: string;
  slotKey: string;
  label: string;
  manufacturer: string;
  shape: PartShape;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  diameterMm: number;
  innerDiameterMm: number | null;
  /** Centre position in millimetres, x along the assembly axis. */
  position: [number, number, number];
  rotationDeg: [number, number, number];
  /** Dimensions that were substituted because the manufacturer publishes none. */
  defaultedDimensions: string[];
  /**
   * True when the part's *primary* dimension (length, or diameter for round
   * parts) had to be substituted. Cross-section substitutions are recorded in
   * `defaultedDimensions` but do not trigger the stronger visual warning,
   * since few manufacturers publish a width and height for every part.
   */
  lengthApproximate: boolean;
}

interface Placeholder {
  shape: PartShape;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  diameterMm: number;
}

/** Neutral placeholder envelopes, used only when a dimension is unpublished. */
const PLACEHOLDERS: Record<string, Placeholder> = {
  "upper-receiver": { shape: "box", lengthMm: 200, widthMm: 40, heightMm: 60, diameterMm: 40 },
  "lower-receiver": { shape: "box", lengthMm: 200, widthMm: 38, heightMm: 82, diameterMm: 38 },
  barrel: { shape: "cylinder", lengthMm: 406, widthMm: 20, heightMm: 20, diameterMm: 20 },
  handguard: { shape: "tube", lengthMm: 330, widthMm: 45, heightMm: 45, diameterMm: 45 },
  "muzzle-device": { shape: "cylinder", lengthMm: 60, widthMm: 24, heightMm: 24, diameterMm: 24 },
  suppressor: { shape: "cylinder", lengthMm: 160, widthMm: 38, heightMm: 38, diameterMm: 38 },
  "bolt-carrier-group": { shape: "cylinder", lengthMm: 180, widthMm: 25, heightMm: 25, diameterMm: 25 },
  "charging-handle": { shape: "box", lengthMm: 95, widthMm: 44, heightMm: 12, diameterMm: 20 },
  trigger: { shape: "box", lengthMm: 60, widthMm: 18, heightMm: 30, diameterMm: 20 },
  stock: { shape: "box", lengthMm: 180, widthMm: 40, heightMm: 70, diameterMm: 40 },
  grip: { shape: "box", lengthMm: 42, widthMm: 34, heightMm: 110, diameterMm: 34 },
  "buffer-system": { shape: "cylinder", lengthMm: 190, widthMm: 30, heightMm: 30, diameterMm: 30 },
  optic: { shape: "box", lengthMm: 80, widthMm: 40, heightMm: 40, diameterMm: 34 },
  mount: { shape: "box", lengthMm: 60, widthMm: 34, heightMm: 34, diameterMm: 34 },
  bipod: { shape: "box", lengthMm: 60, widthMm: 70, heightMm: 130, diameterMm: 40 },
  light: { shape: "cylinder", lengthMm: 90, widthMm: 26, heightMm: 26, diameterMm: 26 },
  "sling-hardware": { shape: "box", lengthMm: 30, widthMm: 22, heightMm: 22, diameterMm: 22 },
  accessory: { shape: "box", lengthMm: 120, widthMm: 20, heightMm: 12, diameterMm: 20 },
};

const FALLBACK: Placeholder = {
  shape: "box",
  lengthMm: 80,
  widthMm: 30,
  heightMm: 30,
  diameterMm: 30,
};

/** Build the placed-part list for an assembly. */
export function placeAssembly(components: AssemblyComponent[]): PlacedPart[] {
  const { spans } = layoutAssembly(components);
  const bySlot = new Map(components.map((component) => [component.slotKey, component]));
  const placed: PlacedPart[] = [];

  // First pass: axial parts positioned from the layout spans.
  const positions = new Map<string, [number, number, number]>();

  for (const component of components) {
    const slot = SLOT_BY_KEY.get(component.slotKey);
    const placeholder = PLACEHOLDERS[component.product.categorySlug] ?? FALLBACK;
    const defaulted: string[] = [];

    const length = getDimensionMm(component.product, "length");
    const diameter = getDimensionMm(component.product, "diameter");
    const width = component.product.widthMm;
    const height = component.product.heightMm;
    const inner = getDimensionMm(component.product, "innerDiameter");

    if (length === null) defaulted.push("length");
    if (diameter === null && placeholder.shape !== "box") defaulted.push("diameter");
    if (width === null && placeholder.shape === "box") defaulted.push("width");
    if (height === null && placeholder.shape === "box") defaulted.push("height");

    const resolved = {
      lengthMm: length ?? placeholder.lengthMm,
      diameterMm: diameter ?? placeholder.diameterMm,
      widthMm: width ?? diameter ?? placeholder.widthMm,
      heightMm: height ?? diameter ?? placeholder.heightMm,
    };

    const span = spans.get(component.slotKey);
    let position: [number, number, number];
    if (span && span.endMm > span.startMm) {
      position = [(span.startMm + span.endMm) / 2, slot?.offset[1] ?? 0, slot?.offset[2] ?? 0];
    } else {
      // Non-axial slots hang off their parent's position by the slot offset.
      const parentKey = slot?.parent;
      const parentPosition = parentKey ? positions.get(parentKey) : undefined;
      const parentSpan = parentKey ? spans.get(parentKey) : undefined;
      const originX = parentSpan
        ? parentSpan.startMm
        : (parentPosition?.[0] ?? 0);
      position = [
        originX + (slot?.offset[0] ?? 0),
        (parentPosition?.[1] ?? 0) + (slot?.offset[1] ?? 0),
        (parentPosition?.[2] ?? 0) + (slot?.offset[2] ?? 0),
      ];
    }
    positions.set(component.slotKey, position);

    placed.push({
      productId: component.product.id,
      slotKey: component.slotKey,
      label: component.product.productName,
      manufacturer: component.product.manufacturerName,
      shape: placeholder.shape,
      lengthMm: resolved.lengthMm,
      widthMm: resolved.widthMm,
      heightMm: resolved.heightMm,
      diameterMm: resolved.diameterMm,
      innerDiameterMm: inner,
      position,
      rotationDeg: slot?.rotation ?? [0, 0, 0],
      defaultedDimensions: defaulted,
      lengthApproximate:
        defaulted.includes("length") ||
        (placeholder.shape !== "box" && defaulted.includes("diameter")),
    });
  }

  void bySlot;
  return placed;
}

/** Bounding box of the placed assembly, in millimetres. */
export function assemblyBounds(parts: PlacedPart[]): {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
} {
  if (parts.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], size: [1, 1, 1] };
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) {
    const halfLength = part.lengthMm / 2;
    const halfWidth = (part.shape === "box" ? part.widthMm : part.diameterMm) / 2;
    const halfHeight = (part.shape === "box" ? part.heightMm : part.diameterMm) / 2;
    const extents: [number, number, number] = [halfLength, halfHeight, halfWidth];
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], part.position[axis] - extents[axis]);
      max[axis] = Math.max(max[axis], part.position[axis] + extents[axis]);
    }
  }
  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const size: [number, number, number] = [
    Math.max(1, max[0] - min[0]),
    Math.max(1, max[1] - min[1]),
    Math.max(1, max[2] - min[2]),
  ];
  return { min, max, center, size };
}

export { slotLabel };
