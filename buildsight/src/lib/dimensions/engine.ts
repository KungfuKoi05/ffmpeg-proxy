/**
 * Dimensional clearance engine.
 *
 * This subsystem answers a narrower question than the compatibility engine:
 * *given the dimensions the manufacturers published, do these parts physically
 * clear one another, and how long is the result?*
 *
 * A green clearance result is NOT a claim of functional compatibility. The UI
 * keeps the three ideas separate: documented compatibility, dimensional
 * clearance, and functional compatibility (which is only ever asserted by an
 * explicit rule).
 */

import { SLOT_BY_KEY, slotLabel } from "@/lib/assembly/slots";
import { getDimensionMm } from "@/lib/dimensions/access";
import { VERIFICATION_RANK } from "@/lib/catalog/vocabulary";
import { round } from "@/lib/units";
import type {
  AssemblyComponent,
  AssemblyInput,
  AssemblySegment,
  ClearanceFinding,
  DimensionalReport,
  Measurement,
  SignalState,
  VerificationStatus,
} from "@/lib/types";

/** Slots that lie on the assembly axis, rear to front. */
const AXIAL_CHAIN = [
  "stock",
  "buffer-system",
  "upper-receiver",
  "barrel",
  "muzzle-device",
  "suppressor",
];

/** Minimum radial gap before a fit is called tight rather than clear. */
export const TIGHT_CLEARANCE_MM = 1.5;

function weakest(...statuses: VerificationStatus[]): VerificationStatus {
  if (statuses.length === 0) return "UNVERIFIED";
  return statuses.reduce((lowest, current) =>
    (VERIFICATION_RANK[current] ?? 0) < (VERIFICATION_RANK[lowest] ?? 0) ? current : lowest,
  );
}

function first(components: AssemblyComponent[], slotKey: string): AssemblyComponent | undefined {
  return components.find((c) => c.slotKey === slotKey);
}

interface Span {
  startMm: number;
  endMm: number;
  approximate: boolean;
}

/**
 * Lay the assembly out along the +X axis from published lengths. When a length
 * is missing the chain is marked approximate from that point forward and the
 * overall length is withheld rather than estimated.
 */
export function layoutAssembly(components: AssemblyComponent[]): {
  spans: Map<string, Span>;
  segments: AssemblySegment[];
  overallLengthMm: number | null;
  brokenAt: string | null;
} {
  const spans = new Map<string, Span>();
  const segments: AssemblySegment[] = [];
  let cursor = 0;
  let broken = false;
  let brokenAt: string | null = null;

  for (const slotKey of AXIAL_CHAIN) {
    const component = first(components, slotKey);
    if (!component) continue;
    const length = getDimensionMm(component.product, "length");
    if (length === null) {
      broken = true;
      brokenAt = brokenAt ?? slotKey;
      spans.set(slotKey, { startMm: cursor, endMm: cursor, approximate: true });
      segments.push({
        productId: component.product.id,
        slotKey,
        label: `${component.product.manufacturerName} ${component.product.productName}`,
        startMm: cursor,
        endMm: cursor,
        diameterMm: getDimensionMm(component.product, "diameter"),
        approximate: true,
      });
      continue;
    }
    const span = { startMm: cursor, endMm: cursor + length, approximate: broken };
    spans.set(slotKey, span);
    segments.push({
      productId: component.product.id,
      slotKey,
      label: `${component.product.manufacturerName} ${component.product.productName}`,
      startMm: span.startMm,
      endMm: span.endMm,
      diameterMm: getDimensionMm(component.product, "diameter"),
      approximate: broken,
    });
    cursor = span.endMm;
  }

  // The handguard hangs off the receiver face and runs forward over the barrel.
  const handguard = first(components, "handguard");
  if (handguard) {
    const barrelSpan = spans.get("barrel");
    const start = barrelSpan?.startMm ?? spans.get("upper-receiver")?.endMm ?? 0;
    const length = getDimensionMm(handguard.product, "length");
    const span: Span = {
      startMm: start,
      endMm: length === null ? start : start + length,
      approximate: length === null || broken,
    };
    spans.set("handguard", span);
    segments.push({
      productId: handguard.product.id,
      slotKey: "handguard",
      label: `${handguard.product.manufacturerName} ${handguard.product.productName}`,
      startMm: span.startMm,
      endMm: span.endMm,
      diameterMm: getDimensionMm(handguard.product, "diameter"),
      approximate: span.approximate,
    });
  }

  // The lower receiver sits under the upper and does not extend the assembly.
  const lower = first(components, "lower-receiver");
  if (lower) {
    const upperSpan = spans.get("upper-receiver");
    const length = getDimensionMm(lower.product, "length");
    const start = upperSpan?.startMm ?? 0;
    const span: Span = {
      startMm: start,
      endMm: length === null ? (upperSpan?.endMm ?? start) : start + length,
      approximate: length === null,
    };
    spans.set("lower-receiver", span);
    segments.push({
      productId: lower.product.id,
      slotKey: "lower-receiver",
      label: `${lower.product.manufacturerName} ${lower.product.productName}`,
      startMm: span.startMm,
      endMm: span.endMm,
      diameterMm: null,
      approximate: span.approximate,
    });
  }

  const axialComponents = components.filter((c) => AXIAL_CHAIN.includes(c.slotKey));
  const missingLength = axialComponents.some(
    (c) => getDimensionMm(c.product, "length") === null,
  );
  const overallLengthMm =
    axialComponents.length > 0 && !missingLength ? round(cursor, 2) : null;

  return { spans, segments, overallLengthMm, brokenAt };
}

function overlaps(a: Span | undefined, b: Span | undefined): boolean {
  if (!a || !b) return false;
  return a.startMm < b.endMm && b.startMm < a.endMm;
}

function radialClearance(
  components: AssemblyComponent[],
  spans: Map<string, Span>,
  hostSlot: string,
  innerKey: string,
  guestSlot: string,
  outerKey: string,
): ClearanceFinding | null {
  const host = first(components, hostSlot);
  const guest = first(components, guestSlot);
  if (!host || !guest) return null;
  if (hostSlot !== guestSlot && !overlaps(spans.get(hostSlot), spans.get(guestSlot))) {
    // The two parts do not share axial space, so there is nothing to check.
    return null;
  }

  const inner = getDimensionMm(host.product, innerKey);
  const outer = getDimensionMm(guest.product, outerKey);
  const label = `${slotLabel(hostSlot)} inner bore vs ${slotLabel(guestSlot)} outer diameter`;
  const measuredFrom = [
    `${host.product.productName} ${innerKey}`,
    `${guest.product.productName} ${outerKey}`,
  ];

  if (inner === null || outer === null) {
    return {
      id: `radial:${hostSlot}:${guestSlot}`,
      label,
      state: "GRAY",
      explanation: `Unknown — ${
        inner === null ? host.product.productName : guest.product.productName
      } does not publish the ${inner === null ? innerKey : outerKey} dimension needed to compute this clearance.`,
      subjectProductId: guest.product.id,
      targetProductId: host.product.id,
      valueMm: null,
      measuredFrom,
    };
  }

  const clearance = round((inner - outer) / 2, 2);
  let state: SignalState = "GREEN";
  let explanation = `Clears by ${clearance.toFixed(2)} mm radially, from published dimensions.`;
  if (clearance < 0) {
    state = "RED";
    explanation = `Documented dimensional conflict — the ${slotLabel(
      guestSlot,
    ).toLowerCase()} outer diameter (${outer.toFixed(2)} mm) exceeds the ${slotLabel(
      hostSlot,
    ).toLowerCase()} inner bore (${inner.toFixed(2)} mm) by ${Math.abs(clearance * 2).toFixed(2)} mm.`;
  } else if (clearance < TIGHT_CLEARANCE_MM) {
    state = "YELLOW";
    explanation = `Clearance is ${clearance.toFixed(
      2,
    )} mm radially — under the ${TIGHT_CLEARANCE_MM} mm advisory threshold. Manufacturer fitment guidance should be consulted.`;
  }

  return {
    id: `radial:${hostSlot}:${guestSlot}`,
    label,
    state,
    explanation,
    subjectProductId: guest.product.id,
    targetProductId: host.product.id,
    valueMm: clearance,
    measuredFrom,
  };
}

function handguardMuzzleAxial(
  components: AssemblyComponent[],
  spans: Map<string, Span>,
): ClearanceFinding | null {
  const handguard = first(components, "handguard");
  const barrel = first(components, "barrel");
  if (!handguard || !barrel) return null;

  const handguardSpan = spans.get("handguard");
  const barrelSpan = spans.get("barrel");
  const handguardLength = getDimensionMm(handguard.product, "length");
  const barrelLength = getDimensionMm(barrel.product, "length");
  const label = "Handguard forward edge vs muzzle";
  const measuredFrom = [
    `${handguard.product.productName} length`,
    `${barrel.product.productName} length`,
  ];

  if (handguardLength === null || barrelLength === null || !handguardSpan || !barrelSpan) {
    return {
      id: "axial:handguard-barrel",
      label,
      state: "GRAY",
      explanation: `Unknown — ${
        handguardLength === null ? handguard.product.productName : barrel.product.productName
      } does not publish a length, so the forward edge position cannot be derived.`,
      subjectProductId: handguard.product.id,
      targetProductId: barrel.product.id,
      valueMm: null,
      measuredFrom,
    };
  }

  const clearance = round(barrelSpan.endMm - handguardSpan.endMm, 2);
  let state: SignalState = "GREEN";
  let explanation = `The handguard ends ${clearance.toFixed(
    2,
  )} mm behind the muzzle, from published lengths.`;
  if (clearance < 0) {
    state = "RED";
    explanation = `Documented dimensional conflict — the handguard extends ${Math.abs(
      clearance,
    ).toFixed(2)} mm past the muzzle.`;
  } else if (clearance < 10) {
    state = "YELLOW";
    explanation = `The handguard ends ${clearance.toFixed(
      2,
    )} mm behind the muzzle, leaving little room for a muzzle device shoulder. Check the manufacturer's fitment notes.`;
  }

  return {
    id: "axial:handguard-barrel",
    label,
    state,
    explanation,
    subjectProductId: handguard.product.id,
    targetProductId: barrel.product.id,
    valueMm: clearance,
    measuredFrom,
  };
}

function collectMeasurements(components: AssemblyComponent[]): Measurement[] {
  const measurements: Measurement[] = [];
  for (const component of components) {
    const slot = SLOT_BY_KEY.get(component.slotKey);
    const length = getDimensionMm(component.product, "length");
    measurements.push({
      key: `${component.slotKey}:length`,
      label: `${slot?.label ?? component.slotKey} length`,
      valueMm: length,
      verification: component.product.verificationStatus,
      productId: component.product.id,
      note: length === null ? "Not provided by manufacturer." : undefined,
    });
    const diameter = getDimensionMm(component.product, "diameter");
    if (diameter !== null) {
      measurements.push({
        key: `${component.slotKey}:diameter`,
        label: `${slot?.label ?? component.slotKey} outer diameter`,
        valueMm: diameter,
        verification: component.product.verificationStatus,
        productId: component.product.id,
      });
    }
    const inner = getDimensionMm(component.product, "innerDiameter");
    if (inner !== null) {
      measurements.push({
        key: `${component.slotKey}:innerDiameter`,
        label: `${slot?.label ?? component.slotKey} inner bore`,
        valueMm: inner,
        verification: component.product.verificationStatus,
        productId: component.product.id,
      });
    }
  }
  return measurements;
}

export function computeDimensions(input: AssemblyInput): DimensionalReport {
  const { components } = input;
  const { spans, segments, overallLengthMm, brokenAt } = layoutAssembly(components);

  const clearances: ClearanceFinding[] = [];
  const radialChecks: Array<[string, string, string, string]> = [
    ["handguard", "innerDiameter", "barrel", "diameter"],
    ["handguard", "innerDiameter", "muzzle-device", "diameter"],
    ["handguard", "innerDiameter", "suppressor", "diameter"],
    ["suppressor", "innerDiameter", "muzzle-device", "diameter"],
  ];
  for (const [hostSlot, innerKey, guestSlot, outerKey] of radialChecks) {
    const finding = radialClearance(components, spans, hostSlot, innerKey, guestSlot, outerKey);
    if (finding) clearances.push(finding);
  }

  const axial = handguardMuzzleAxial(components, spans);
  if (axial) clearances.push(axial);

  const axialComponents = components.filter((c) =>
    AXIAL_CHAIN.includes(c.slotKey),
  );
  const overallLengthConfidence =
    overallLengthMm === null
      ? null
      : weakest(...axialComponents.map((c) => c.product.verificationStatus));

  const overallLengthNote =
    overallLengthMm === null
      ? brokenAt
        ? `Overall length withheld — ${slotLabel(brokenAt)} has no published length.`
        : "Overall length requires at least one component on the assembly axis."
      : "Derived by summing published component lengths along the assembly axis. Threaded and clamped interfaces overlap in reality; treat this as an upper bound unless the manufacturer publishes an installed length.";

  return {
    overallLengthMm,
    overallLengthConfidence,
    overallLengthNote,
    measurements: collectMeasurements(components),
    clearances,
    segments: segments.sort((a, b) => a.startMm - b.startMm),
  };
}

/** Worst signal across a set of clearance findings, for summary badges. */
export function worstSignal(findings: ClearanceFinding[]): SignalState {
  const order: SignalState[] = ["GREEN", "GRAY", "YELLOW", "RED"];
  return findings.reduce<SignalState>(
    (worst, finding) =>
      order.indexOf(finding.state) > order.indexOf(worst) ? finding.state : worst,
    "GREEN",
  );
}
