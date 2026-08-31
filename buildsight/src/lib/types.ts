/**
 * Plain-object types shared by the compatibility, dimension, scoring and
 * export engines.
 *
 * The engines never import Prisma. They operate on these structures so they
 * can be unit tested without a database and reused on the client for
 * optimistic recomputation in the Build Studio.
 */

export type VerificationStatus =
  | "VERIFIED_MANUFACTURER"
  | "VERIFIED_DISTRIBUTOR"
  | "SECONDARY_SOURCE"
  | "USER_SUBMITTED"
  | "UNVERIFIED";

export type CompatibilityState = "COMPATIBLE" | "INCOMPATIBLE" | "CONDITIONAL" | "UNKNOWN";

export type Availability =
  | "IN_STOCK"
  | "LOW_STOCK"
  | "BACKORDER"
  | "OUT_OF_STOCK"
  | "DISCONTINUED"
  | "UNKNOWN";

export type RegulatoryClass =
  | "UNREGULATED_ACCESSORY"
  | "SERIALIZED_COMPONENT"
  | "NFA_ITEM"
  | "RESTRICTED_OTHER"
  | "UNCLASSIFIED";

export type RuleKind =
  | "INTERFACE_MATCH"
  | "THREAD_MATCH"
  | "PLATFORM_MATCH"
  | "CALIBER_MATCH"
  | "GAS_SYSTEM_MATCH"
  | "DIMENSIONAL_CONSTRAINT"
  | "EXPLICIT_PAIR"
  | "REQUIRES_COMPONENT"
  | "MUTUALLY_EXCLUSIVE";

/** Traffic-light state used by every visual indicator in the product. */
export type SignalState = "GREEN" | "YELLOW" | "RED" | "GRAY";

/** The minimal product projection the engines need. */
export interface ProductFacts {
  id: string;
  slug: string;
  productName: string;
  manufacturerName: string;
  manufacturerPartNumber: string;
  categorySlug: string;
  platform: string | null;
  caliber: string | null;

  msrpCents: number | null;
  currentPriceCents: number | null;
  currency: string;

  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  diameterMm: number | null;
  innerDiameterMm: number | null;

  mountingInterface: string | null;
  threadSpecification: string | null;
  gasSystemCompatibility: string | null;
  handguardInterface: string | null;
  receiverInterface: string | null;
  opticInterface: string | null;
  suppressorCompatibility: string | null;
  barrelCompatibility: string | null;

  /** Extra structured dimensions keyed by `Dimension.kind`, in millimetres. */
  extraDimensionsMm: Record<string, number>;

  verificationStatus: VerificationStatus;
  availability: Availability;
  regulatoryClass: RegulatoryClass;
  sourceUrl: string | null;
  productUrl: string | null;
  manufacturerUrl: string | null;
  imageUrl: string | null;
  lastVerified: string | null;
  isDemo: boolean;
}

/** A compatibility rule as consumed by the engine. */
export interface CompatibilityRuleInput {
  id: string;
  kind: RuleKind;
  name: string;
  subjectCategorySlug: string | null;
  targetCategorySlug: string | null;
  subjectProductId: string | null;
  targetProductId: string | null;
  subjectField: string | null;
  targetField: string | null;
  parameters: RuleParameters | null;
  result: CompatibilityState;
  explanation: string;
  condition: string | null;
  sourceUrl: string | null;
  verificationStatus: VerificationStatus;
  priority: number;
}

export interface RuleParameters {
  /** Values on the target that the subject additionally accepts. */
  acceptedTargetValues?: string[];
  /** Result used when the two field values differ. Defaults to INCOMPATIBLE. */
  mismatchResult?: CompatibilityState;
  /** Explanation used when the two field values differ. */
  mismatchExplanation?: string;
  /** DIMENSIONAL_CONSTRAINT: dimension keys and comparison. */
  subjectDimension?: string;
  targetDimension?: string;
  comparison?: "lt" | "lte" | "gt" | "gte";
  offsetMm?: number;
  /** REQUIRES_COMPONENT: category that must also be present. */
  requiredCategorySlug?: string;
  /** MUTUALLY_EXCLUSIVE: categories that cannot co-exist. */
  exclusiveCategorySlugs?: string[];
  /**
   * Suppress the rule when the assembly already contains a component in one of
   * these categories. Used for fallback rules such as "an optic clamps to the
   * receiver rail, unless a mount is installed".
   */
  skipIfCategoryPresent?: string[];
  [key: string]: unknown;
}

/** One component placed into an assembly slot. */
export interface AssemblyComponent {
  slotKey: string;
  quantity: number;
  product: ProductFacts;
}

export interface AssemblyInput {
  platform: string | null;
  components: AssemblyComponent[];
}

export interface CompatibilityFinding {
  id: string;
  subjectSlot: string;
  targetSlot: string;
  subjectProductId: string;
  targetProductId: string | null;
  subjectLabel: string;
  targetLabel: string;
  state: CompatibilityState;
  explanation: string;
  condition: string | null;
  ruleId: string | null;
  ruleName: string | null;
  ruleKind: RuleKind | null;
  /** Weakest verification level among the rule and the compared fields. */
  confidence: VerificationStatus;
  sourceUrl: string | null;
}

export interface CompatibilityReport {
  overall: CompatibilityState;
  findings: CompatibilityFinding[];
  counts: Record<CompatibilityState, number>;
  /** Categories the platform expects that the build does not yet contain. */
  missingCoreCategories: string[];
}

export interface Measurement {
  key: string;
  label: string;
  valueMm: number | null;
  verification: VerificationStatus;
  productId?: string;
  note?: string;
}

export interface ClearanceFinding {
  id: string;
  label: string;
  state: SignalState;
  explanation: string;
  subjectProductId: string;
  targetProductId: string;
  /** Positive = clearance, negative = overlap/interference, in millimetres. */
  valueMm: number | null;
  measuredFrom: string[];
}

export interface DimensionalReport {
  /** Overall length along the assembly axis, when it can be derived. */
  overallLengthMm: number | null;
  overallLengthConfidence: VerificationStatus | null;
  overallLengthNote: string | null;
  measurements: Measurement[];
  clearances: ClearanceFinding[];
  /** Segment layout used by the 2D technical view. */
  segments: AssemblySegment[];
}

export interface AssemblySegment {
  productId: string;
  slotKey: string;
  label: string;
  /** Position of the segment's leading edge along the assembly axis (mm). */
  startMm: number;
  endMm: number;
  diameterMm: number | null;
  approximate: boolean;
}
