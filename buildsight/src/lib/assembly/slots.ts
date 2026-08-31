/**
 * The assembly slot graph.
 *
 * Slots describe *where* a component sits in the assembly and *what it hangs
 * off*. The graph drives three things: which component pairs the compatibility
 * engine evaluates, how the 3D viewer snaps parts together, and the ordering
 * of the technical 2D view.
 *
 * Geometry here is a neutral scaffold used only to lay out visual
 * approximations; it is never presented as a manufacturer measurement.
 */

export interface SlotDefinition {
  key: string;
  label: string;
  categorySlug: string;
  /** Slot this one mounts onto. `null` marks the assembly root. */
  parent: string | null;
  /** Interface asserted by this connection, for the engine's pair selection. */
  connectionInterface: string | null;
  /** Default local offset from the parent slot origin, in millimetres. */
  offset: [number, number, number];
  /** Default rotation in degrees. */
  rotation?: [number, number, number];
  /** Slots are laid out along +X; this is the axial ordering for 2D views. */
  axialOrder: number;
  /** Whether the slot contributes to overall length along the axis. */
  contributesToOverallLength: boolean;
  optional: boolean;
}

export const SLOTS: SlotDefinition[] = [
  {
    key: "lower-receiver",
    label: "Lower receiver",
    categorySlug: "lower-receiver",
    parent: null,
    connectionInterface: null,
    offset: [0, 0, 0],
    axialOrder: 20,
    contributesToOverallLength: false,
    optional: false,
  },
  {
    key: "upper-receiver",
    label: "Upper receiver",
    categorySlug: "upper-receiver",
    parent: "lower-receiver",
    connectionInterface: "receiver",
    offset: [0, 38, 0],
    axialOrder: 21,
    contributesToOverallLength: true,
    optional: false,
  },
  {
    key: "barrel",
    label: "Barrel",
    categorySlug: "barrel",
    parent: "upper-receiver",
    connectionInterface: "barrel-extension",
    offset: [95, 0, 0],
    axialOrder: 30,
    contributesToOverallLength: true,
    optional: false,
  },
  {
    key: "handguard",
    label: "Handguard",
    categorySlug: "handguard",
    parent: "upper-receiver",
    connectionInterface: "handguard",
    offset: [95, 0, 0],
    axialOrder: 31,
    contributesToOverallLength: false,
    optional: true,
  },
  {
    key: "muzzle-device",
    label: "Muzzle device",
    categorySlug: "muzzle-device",
    parent: "barrel",
    connectionInterface: "thread",
    offset: [0, 0, 0],
    axialOrder: 40,
    contributesToOverallLength: true,
    optional: true,
  },
  {
    key: "suppressor",
    label: "Suppressor",
    categorySlug: "suppressor",
    parent: "muzzle-device",
    connectionInterface: "suppressor",
    offset: [0, 0, 0],
    axialOrder: 41,
    contributesToOverallLength: true,
    optional: true,
  },
  {
    key: "bolt-carrier-group",
    label: "Bolt carrier group",
    categorySlug: "bolt-carrier-group",
    parent: "upper-receiver",
    connectionInterface: "internal",
    offset: [-10, 0, 0],
    axialOrder: 22,
    contributesToOverallLength: false,
    optional: true,
  },
  {
    key: "charging-handle",
    label: "Charging handle",
    categorySlug: "charging-handle",
    parent: "upper-receiver",
    connectionInterface: "internal",
    offset: [-40, 6, 0],
    axialOrder: 23,
    contributesToOverallLength: false,
    optional: true,
  },
  {
    key: "trigger",
    label: "Trigger",
    categorySlug: "trigger",
    parent: "lower-receiver",
    connectionInterface: "internal",
    offset: [10, -6, 0],
    axialOrder: 24,
    contributesToOverallLength: false,
    optional: true,
  },
  {
    key: "buffer-system",
    label: "Buffer system",
    categorySlug: "buffer-system",
    parent: "lower-receiver",
    connectionInterface: "receiver-extension",
    offset: [-95, 30, 0],
    axialOrder: 10,
    contributesToOverallLength: true,
    optional: true,
  },
  {
    key: "stock",
    label: "Stock",
    categorySlug: "stock",
    parent: "buffer-system",
    connectionInterface: "receiver-extension",
    offset: [-40, 0, 0],
    axialOrder: 5,
    contributesToOverallLength: true,
    optional: true,
  },
  {
    key: "grip",
    label: "Grip",
    categorySlug: "grip",
    parent: "lower-receiver",
    connectionInterface: "grip",
    offset: [-30, -30, 0],
    rotation: [0, 0, -20],
    axialOrder: 25,
    contributesToOverallLength: false,
    optional: true,
  },
  {
    key: "optic",
    label: "Optic",
    categorySlug: "optic",
    // Optics hang off a mount when one is present; `resolveEffectiveParent`
    // walks up to the receiver when the mount slot is empty.
    parent: "mount",
    connectionInterface: "optic",
    offset: [-20, 30, 0],
    axialOrder: 26,
    contributesToOverallLength: false,
    optional: true,
  },
  {
    key: "mount",
    label: "Optic mount",
    categorySlug: "mount",
    parent: "upper-receiver",
    connectionInterface: "optic",
    offset: [-20, 24, 0],
    axialOrder: 27,
    contributesToOverallLength: false,
    optional: true,
  },
  {
    key: "bipod",
    label: "Bipod",
    categorySlug: "bipod",
    parent: "handguard",
    connectionInterface: "accessory-rail",
    offset: [200, -30, 0],
    axialOrder: 32,
    contributesToOverallLength: false,
    optional: true,
  },
  {
    key: "light",
    label: "Light",
    categorySlug: "light",
    parent: "handguard",
    connectionInterface: "accessory-rail",
    offset: [180, -6, 28],
    axialOrder: 33,
    contributesToOverallLength: false,
    optional: true,
  },
  {
    key: "sling-hardware",
    label: "Sling hardware",
    categorySlug: "sling-hardware",
    parent: "handguard",
    connectionInterface: "accessory-rail",
    offset: [120, -20, -24],
    axialOrder: 34,
    contributesToOverallLength: false,
    optional: true,
  },
  {
    key: "accessory",
    label: "Accessory",
    categorySlug: "accessory",
    parent: "handguard",
    connectionInterface: "accessory-rail",
    offset: [140, 20, 0],
    axialOrder: 35,
    contributesToOverallLength: false,
    optional: true,
  },
];

export const SLOT_BY_KEY = new Map(SLOTS.map((s) => [s.key, s]));

const SLOT_BY_CATEGORY = new Map<string, SlotDefinition>();
for (const slot of SLOTS) {
  if (!SLOT_BY_CATEGORY.has(slot.categorySlug)) SLOT_BY_CATEGORY.set(slot.categorySlug, slot);
}

/** Default slot for a category, used when a component is dropped in. */
export function slotForCategory(categorySlug: string): SlotDefinition | undefined {
  return SLOT_BY_CATEGORY.get(categorySlug);
}

export function slotLabel(key: string): string {
  return SLOT_BY_KEY.get(key)?.label ?? key;
}

/** Parent/child slot pairs — the connections the engine must evaluate. */
export function slotAdjacency(): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const slot of SLOTS) {
    if (slot.parent) pairs.push([slot.parent, slot.key]);
  }
  return pairs;
}

/** Slots ordered for the 2D technical view, muzzle-end last. */
export function slotsInAxialOrder(): SlotDefinition[] {
  return [...SLOTS].sort((a, b) => a.axialOrder - b.axialOrder);
}

/** Categories a build should contain before it is considered complete. */
export const CORE_CATEGORIES = ["upper-receiver", "lower-receiver", "barrel", "bolt-carrier-group"];
