import { z } from "zod";
import { CATEGORIES, PLATFORMS } from "@/lib/catalog/vocabulary";
import { SLOTS } from "@/lib/assembly/slots";

const categorySlugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];
const platformSlugs = PLATFORMS.map((p) => p.slug) as [string, ...string[]];
const slotKeys = SLOTS.map((s) => s.key) as [string, ...string[]];

export const verificationStatusSchema = z.enum([
  "VERIFIED_MANUFACTURER",
  "VERIFIED_DISTRIBUTOR",
  "SECONDARY_SOURCE",
  "USER_SUBMITTED",
  "UNVERIFIED",
]);

export const availabilitySchema = z.enum([
  "IN_STOCK",
  "LOW_STOCK",
  "BACKORDER",
  "OUT_OF_STOCK",
  "DISCONTINUED",
  "UNKNOWN",
]);

export const regulatoryClassSchema = z.enum([
  "UNREGULATED_ACCESSORY",
  "SERIALIZED_COMPONENT",
  "NFA_ITEM",
  "RESTRICTED_OTHER",
  "UNCLASSIFIED",
]);

export const productSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.enum(categorySlugs).optional(),
  manufacturer: z.string().trim().max(100).optional(),
  platform: z.enum(platformSlugs).optional(),
  caliber: z.string().trim().max(60).optional(),
  verification: verificationStatusSchema.optional(),
  availability: availabilitySchema.optional(),
  interface: z.string().trim().max(60).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  maxWeight: z.coerce.number().int().min(0).optional(),
  minLength: z.coerce.number().min(0).optional(),
  maxLength: z.coerce.number().min(0).optional(),
  sort: z
    .enum(["relevance", "price-asc", "price-desc", "weight-asc", "name-asc", "newest"])
    .optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type ProductSearchQuery = z.infer<typeof productSearchSchema>;

export const buildComponentSchema = z.object({
  productId: z.string().min(1),
  slotKey: z.enum(slotKeys).optional(),
  quantity: z.number().int().min(1).max(10).optional(),
});

export const createBuildSchema = z.object({
  name: z.string().trim().min(1, "Name your configuration.").max(120),
  description: z.string().trim().max(2000).optional(),
  platform: z.enum(platformSlugs).optional(),
  caliber: z.string().trim().max(60).optional(),
  components: z.array(buildComponentSchema).max(40).optional(),
});

export const updateBuildSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  platform: z.enum(platformSlugs).nullable().optional(),
  caliber: z.string().trim().max(60).nullable().optional(),
  isArchived: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const evaluateSchema = z.object({
  platform: z.string().max(40).nullable().optional(),
  components: z
    .array(
      z.object({
        productId: z.string().min(1),
        slotKey: z.enum(slotKeys).optional(),
        quantity: z.number().int().min(1).max(10).optional(),
      }),
    )
    .max(40),
});

export const watchlistSchema = z.object({
  productId: z.string().min(1),
  targetPriceCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
  notifyByEmail: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
});

export const scopeSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  buildId: z.string().optional(),
});

export const adminProductSchema = z.object({
  manufacturerId: z.string().min(1),
  manufacturerPartNumber: z.string().trim().min(1).max(80),
  productName: z.string().trim().min(1).max(160),
  categorySlug: z.enum(categorySlugs),
  platform: z.enum(platformSlugs).nullable().optional(),
  caliber: z.string().trim().max(60).nullable().optional(),
  msrpCents: z.number().int().min(0).nullable().optional(),
  weightGrams: z.number().int().min(0).nullable().optional(),
  lengthMm: z.number().min(0).nullable().optional(),
  widthMm: z.number().min(0).nullable().optional(),
  heightMm: z.number().min(0).nullable().optional(),
  diameterMm: z.number().min(0).nullable().optional(),
  innerDiameterMm: z.number().min(0).nullable().optional(),
  material: z.string().trim().max(120).nullable().optional(),
  finish: z.string().trim().max(120).nullable().optional(),
  mountingInterface: z.string().trim().max(60).nullable().optional(),
  threadSpecification: z.string().trim().max(60).nullable().optional(),
  gasSystemCompatibility: z.string().trim().max(60).nullable().optional(),
  handguardInterface: z.string().trim().max(60).nullable().optional(),
  receiverInterface: z.string().trim().max(60).nullable().optional(),
  opticInterface: z.string().trim().max(60).nullable().optional(),
  suppressorCompatibility: z.string().trim().max(60).nullable().optional(),
  barrelCompatibility: z.string().trim().max(60).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  manufacturerUrl: z.string().url().max(500).nullable().optional(),
  productUrl: z.string().url().max(500).nullable().optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  technicalDrawingUrl: z.string().url().max(500).nullable().optional(),
  manualUrl: z.string().url().max(500).nullable().optional(),
  sourceUrl: z.string().url().max(500).nullable().optional(),
  verificationStatus: verificationStatusSchema,
  availability: availabilitySchema,
  regulatoryClass: regulatoryClassSchema,
  publishState: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"]),
  lastVerified: z.string().datetime().nullable().optional(),
});

export const adminRuleSchema = z.object({
  name: z.string().trim().min(1).max(160),
  kind: z.enum([
    "INTERFACE_MATCH",
    "THREAD_MATCH",
    "PLATFORM_MATCH",
    "CALIBER_MATCH",
    "GAS_SYSTEM_MATCH",
    "DIMENSIONAL_CONSTRAINT",
    "EXPLICIT_PAIR",
    "REQUIRES_COMPONENT",
    "MUTUALLY_EXCLUSIVE",
  ]),
  subjectCategorySlug: z.enum(categorySlugs).nullable().optional(),
  targetCategorySlug: z.enum(categorySlugs).nullable().optional(),
  subjectProductId: z.string().nullable().optional(),
  targetProductId: z.string().nullable().optional(),
  subjectField: z.string().max(60).nullable().optional(),
  targetField: z.string().max(60).nullable().optional(),
  parameters: z.record(z.string(), z.unknown()).nullable().optional(),
  result: z.enum(["COMPATIBLE", "INCOMPATIBLE", "CONDITIONAL", "UNKNOWN"]),
  explanation: z.string().trim().min(10).max(600),
  condition: z.string().trim().max(400).nullable().optional(),
  sourceUrl: z.string().url().max(500).nullable().optional(),
  verificationStatus: verificationStatusSchema,
  priority: z.number().int().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
});
