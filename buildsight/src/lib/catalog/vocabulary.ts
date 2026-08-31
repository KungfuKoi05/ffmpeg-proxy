/**
 * Controlled vocabulary for the catalog.
 *
 * Interfaces, platforms and gas systems are represented as slugs from a fixed
 * list so the compatibility engine can compare them exactly. Free-text entry
 * is rejected at ingestion time: an unknown interface is a data-quality issue,
 * not a silent "maybe".
 */

export interface CategoryDefinition {
  slug: string;
  name: string;
  /** Parent category slug, for the two-level category tree. */
  parent?: string;
  sortOrder: number;
  description: string;
  /** A build may hold at most this many components in the category. */
  maxPerBuild: number;
  /** Categories a complete build is expected to contain. */
  coreForPlatform?: boolean;
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    slug: "receiver",
    name: "Receiver",
    sortOrder: 10,
    description: "Serialized and non-serialized receiver assemblies.",
    maxPerBuild: 2,
    coreForPlatform: true,
  },
  {
    slug: "upper-receiver",
    name: "Upper Receiver",
    parent: "receiver",
    sortOrder: 11,
    description: "Upper receiver assemblies and stripped uppers.",
    maxPerBuild: 1,
    coreForPlatform: true,
  },
  {
    slug: "lower-receiver",
    name: "Lower Receiver",
    parent: "receiver",
    sortOrder: 12,
    description: "Lower receiver assemblies and stripped lowers.",
    maxPerBuild: 1,
    coreForPlatform: true,
  },
  {
    slug: "barrel",
    name: "Barrel",
    sortOrder: 20,
    description: "Barrels described by length, profile, chambering and thread.",
    maxPerBuild: 1,
    coreForPlatform: true,
  },
  {
    slug: "handguard",
    name: "Handguard",
    sortOrder: 30,
    description: "Handguards and rail systems.",
    maxPerBuild: 1,
  },
  {
    slug: "muzzle-device",
    name: "Muzzle Device",
    sortOrder: 40,
    description: "Muzzle devices described by thread specification.",
    maxPerBuild: 1,
  },
  {
    slug: "suppressor",
    name: "Suppressor",
    sortOrder: 45,
    description: "Sound suppressors. Regulated — routed to the manufacturer's process.",
    maxPerBuild: 1,
  },
  {
    slug: "bolt-carrier-group",
    name: "Bolt Carrier Group",
    sortOrder: 50,
    description: "Bolt carrier groups.",
    maxPerBuild: 1,
    coreForPlatform: true,
  },
  {
    slug: "charging-handle",
    name: "Charging Handle",
    sortOrder: 55,
    description: "Charging handles.",
    maxPerBuild: 1,
  },
  {
    slug: "trigger",
    name: "Trigger",
    sortOrder: 60,
    description: "Trigger groups and assemblies.",
    maxPerBuild: 1,
  },
  {
    slug: "stock",
    name: "Stock",
    sortOrder: 70,
    description: "Stocks and braces described by receiver extension interface.",
    maxPerBuild: 1,
  },
  {
    slug: "grip",
    name: "Grip",
    sortOrder: 75,
    description: "Pistol grips.",
    maxPerBuild: 1,
  },
  {
    slug: "buffer-system",
    name: "Buffer System",
    sortOrder: 80,
    description: "Receiver extensions, buffers and springs.",
    maxPerBuild: 1,
  },
  {
    slug: "optic",
    name: "Optic",
    sortOrder: 90,
    description: "Optics described by mounting footprint.",
    maxPerBuild: 2,
  },
  {
    slug: "mount",
    name: "Mount",
    sortOrder: 95,
    description: "Optic mounts and rings.",
    maxPerBuild: 2,
  },
  {
    slug: "bipod",
    name: "Bipod",
    sortOrder: 100,
    description: "Bipods described by attachment interface.",
    maxPerBuild: 1,
  },
  {
    slug: "light",
    name: "Light",
    sortOrder: 105,
    description: "Weapon lights and pressure switches.",
    maxPerBuild: 2,
  },
  {
    slug: "sling-hardware",
    name: "Sling Hardware",
    sortOrder: 110,
    description: "Sling mounts, swivels and adapters.",
    maxPerBuild: 4,
  },
  {
    slug: "accessory",
    name: "Accessory",
    sortOrder: 120,
    description: "Other documented accessories.",
    maxPerBuild: 8,
  },
];

export const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function categoryName(slug: string): string {
  return CATEGORY_BY_SLUG.get(slug)?.name ?? slug;
}

/** Platform patterns. These are open industry pattern names, not products. */
export interface PlatformDefinition {
  slug: string;
  name: string;
  description: string;
}

export const PLATFORMS: PlatformDefinition[] = [
  {
    slug: "ar15",
    name: "AR-15 pattern",
    description: "Small-frame AR pattern components.",
  },
  {
    slug: "ar10",
    name: "AR-10 pattern",
    description: "Large-frame AR pattern components.",
  },
  {
    slug: "universal",
    name: "Universal",
    description: "Platform-agnostic components such as rail-mounted accessories.",
  },
];

export const PLATFORM_BY_SLUG = new Map(PLATFORMS.map((p) => [p.slug, p]));

export function platformName(slug: string | null | undefined): string {
  if (!slug) return "Unspecified";
  return PLATFORM_BY_SLUG.get(slug)?.name ?? slug;
}

/**
 * Interface vocabulary. `field` records which Product column carries the value
 * so the admin UI and the ingestion validator can steer entry.
 */
export interface InterfaceDefinition {
  slug: string;
  name: string;
  field: InterfaceField;
  description: string;
}

export type InterfaceField =
  | "mountingInterface"
  | "threadSpecification"
  | "gasSystemCompatibility"
  | "handguardInterface"
  | "receiverInterface"
  | "opticInterface"
  | "suppressorCompatibility"
  | "barrelCompatibility";

export const INTERFACE_FIELDS: InterfaceField[] = [
  "mountingInterface",
  "threadSpecification",
  "gasSystemCompatibility",
  "handguardInterface",
  "receiverInterface",
  "opticInterface",
  "suppressorCompatibility",
  "barrelCompatibility",
];

export const INTERFACES: InterfaceDefinition[] = [
  // Rail / accessory mounting
  { slug: "picatinny-1913", name: "Picatinny (MIL-STD-1913)", field: "mountingInterface", description: "Standardised rail slot interface." },
  { slug: "m-lok", name: "M-LOK", field: "mountingInterface", description: "Direct-attach negative-space mounting interface." },
  { slug: "keymod", name: "KeyMod", field: "mountingInterface", description: "Direct-attach keyhole mounting interface." },
  { slug: "arca-swiss", name: "ARCA-Swiss", field: "mountingInterface", description: "Dovetail clamp interface." },
  { slug: "qd-socket", name: "QD sling socket", field: "mountingInterface", description: "Push-button quick-detach sling socket." },

  // Handguard-to-receiver
  { slug: "ar15-barrel-nut-proprietary", name: "Proprietary barrel nut", field: "handguardInterface", description: "Handguard ships with a manufacturer-specific barrel nut." },
  { slug: "ar15-mil-spec-delta-ring", name: "Mil-spec delta ring", field: "handguardInterface", description: "Drop-in handguard using the standard delta ring assembly." },

  // Receiver interfaces
  { slug: "ar15-upper", name: "AR-15 upper receiver", field: "receiverInterface", description: "Small-frame AR upper receiver interface." },
  { slug: "ar15-lower", name: "AR-15 lower receiver", field: "receiverInterface", description: "Small-frame AR lower receiver interface." },
  { slug: "ar10-upper", name: "AR-10 upper receiver", field: "receiverInterface", description: "Large-frame AR upper receiver interface." },
  { slug: "ar10-lower", name: "AR-10 lower receiver", field: "receiverInterface", description: "Large-frame AR lower receiver interface." },
  { slug: "ar15-receiver-extension-mil-spec", name: "Mil-spec receiver extension", field: "receiverInterface", description: "1.148 in outer diameter receiver extension." },
  { slug: "ar15-receiver-extension-commercial", name: "Commercial receiver extension", field: "receiverInterface", description: "1.168 in outer diameter receiver extension." },

  // Barrel interfaces
  { slug: "ar15-barrel-extension", name: "AR-15 barrel extension", field: "barrelCompatibility", description: "Small-frame AR barrel extension pattern." },
  { slug: "ar10-barrel-extension", name: "AR-10 barrel extension", field: "barrelCompatibility", description: "Large-frame AR barrel extension pattern." },

  // Thread specifications
  { slug: "1-2x28", name: '1/2"-28', field: "threadSpecification", description: "Common small-bore muzzle thread." },
  { slug: "5-8x24", name: '5/8"-24', field: "threadSpecification", description: "Common large-bore muzzle thread." },
  { slug: "9-16x24", name: '9/16"-24', field: "threadSpecification", description: "Muzzle thread specification." },
  { slug: "m14x1-lh", name: "M14x1 LH", field: "threadSpecification", description: "Metric left-hand muzzle thread." },
  { slug: "unthreaded", name: "Unthreaded", field: "threadSpecification", description: "No muzzle threading published." },

  // Gas systems
  { slug: "gas-pistol", name: "Pistol-length gas", field: "gasSystemCompatibility", description: "Pistol-length gas system." },
  { slug: "gas-carbine", name: "Carbine-length gas", field: "gasSystemCompatibility", description: "Carbine-length gas system." },
  { slug: "gas-mid", name: "Mid-length gas", field: "gasSystemCompatibility", description: "Mid-length gas system." },
  { slug: "gas-rifle", name: "Rifle-length gas", field: "gasSystemCompatibility", description: "Rifle-length gas system." },

  // Optic footprints
  { slug: "footprint-picatinny", name: "Picatinny footprint", field: "opticInterface", description: "Optic clamps directly to a 1913 rail." },
  { slug: "footprint-micro-t", name: "Micro red-dot footprint A", field: "opticInterface", description: "Common micro red-dot mounting footprint." },
  { slug: "footprint-mini-b", name: "Mini red-dot footprint B", field: "opticInterface", description: "Common mini red-dot mounting footprint." },
  { slug: "footprint-30mm-tube", name: "30 mm tube", field: "opticInterface", description: "30 mm main tube requiring rings." },
  { slug: "footprint-34mm-tube", name: "34 mm tube", field: "opticInterface", description: "34 mm main tube requiring rings." },

  // Suppressor mounting
  { slug: "suppressor-direct-thread", name: "Direct thread", field: "suppressorCompatibility", description: "Suppressor threads directly onto the barrel." },
  { slug: "suppressor-qd-taper", name: "QD taper mount", field: "suppressorCompatibility", description: "Suppressor mounts over a compatible muzzle device." },
];

export const INTERFACE_BY_SLUG = new Map(INTERFACES.map((i) => [i.slug, i]));

export function interfaceName(slug: string | null | undefined): string {
  if (!slug) return "Not specified";
  return INTERFACE_BY_SLUG.get(slug)?.name ?? slug;
}

export function interfacesForField(field: InterfaceField): InterfaceDefinition[] {
  return INTERFACES.filter((i) => i.field === field);
}

export function isKnownInterface(slug: string, field?: InterfaceField): boolean {
  const definition = INTERFACE_BY_SLUG.get(slug);
  if (!definition) return false;
  return field ? definition.field === field : true;
}

export const CALIBERS = [
  "5.56x45mm NATO",
  ".223 Wylde",
  "300 BLK",
  "7.62x39mm",
  "6.5 Creedmoor",
  ".308 Winchester",
  "9x19mm",
  "22 LR",
] as const;

export const VERIFICATION_LABELS: Record<string, string> = {
  VERIFIED_MANUFACTURER: "Verified — manufacturer",
  VERIFIED_DISTRIBUTOR: "Verified — distributor",
  SECONDARY_SOURCE: "Secondary source",
  USER_SUBMITTED: "User submitted",
  UNVERIFIED: "Unverified",
};

/** Ranking used wherever "the weakest link" of a data set matters. */
export const VERIFICATION_RANK: Record<string, number> = {
  VERIFIED_MANUFACTURER: 100,
  VERIFIED_DISTRIBUTOR: 75,
  SECONDARY_SOURCE: 50,
  USER_SUBMITTED: 25,
  UNVERIFIED: 0,
};

export function isAuthoritative(status: string): boolean {
  return status === "VERIFIED_MANUFACTURER";
}
