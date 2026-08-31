/**
 * Demo catalog seed.
 *
 * Every manufacturer, product and retailer created here is synthetic and
 * labelled DEMO. No real manufacturer specification is reproduced or invented.
 * The data set is shaped to exercise every path in the engines: verified and
 * unverified records, missing measurements, a documented interface mismatch,
 * a documented dimensional conflict, a conditional rule and an unknown result.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { buildSearchText } from "../src/lib/catalog/search-text";
import { CATEGORIES } from "../src/lib/catalog/vocabulary";
import { evaluateDataQuality } from "../src/lib/quality/data-quality";

const prisma = new PrismaClient();

const DOC = "https://example.com"; // Reserved documentation domain.

interface ProductSeed {
  slug: string;
  manufacturer: string;
  partNumber: string;
  name: string;
  category: string;
  platform?: string;
  caliber?: string;
  msrpCents?: number;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  diameterMm?: number;
  innerDiameterMm?: number;
  material?: string;
  finish?: string;
  mountingInterface?: string;
  threadSpecification?: string;
  gasSystemCompatibility?: string;
  handguardInterface?: string;
  receiverInterface?: string;
  opticInterface?: string;
  suppressorCompatibility?: string;
  barrelCompatibility?: string;
  description: string;
  verificationStatus: Prisma.ProductCreateInput["verificationStatus"];
  availability: Prisma.ProductCreateInput["availability"];
  regulatoryClass: Prisma.ProductCreateInput["regulatoryClass"];
  /** Extra structured dimensions in millimetres, keyed by Dimension.kind. */
  extraDimensions?: Record<string, number>;
  retailPriceCents?: number;
  /** Set for records that deliberately model incomplete manufacturer data. */
  notes?: string;
}

const MANUFACTURERS = [
  {
    slug: "demo-precision-works",
    name: "DEMO MANUFACTURER — Precision Works",
    country: "United States",
    description:
      "Synthetic manufacturer used by the BuildSight demo catalog. All specifications are fictional.",
  },
  {
    slug: "demo-modular-systems",
    name: "DEMO MANUFACTURER — Modular Systems",
    country: "United States",
    description:
      "Synthetic manufacturer used by the BuildSight demo catalog. All specifications are fictional.",
  },
  {
    slug: "demo-optics-lab",
    name: "DEMO MANUFACTURER — Optics Lab",
    country: "Germany",
    description:
      "Synthetic optics manufacturer used by the BuildSight demo catalog. All specifications are fictional.",
  },
  {
    slug: "demo-field-components",
    name: "DEMO MANUFACTURER — Field Components",
    country: "United States",
    description:
      "Synthetic manufacturer used by the BuildSight demo catalog. All specifications are fictional.",
  },
];

const PRODUCTS: ProductSeed[] = [
  // ---- Receivers ----------------------------------------------------------
  {
    slug: "demo-forged-upper-receiver",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-UR-15",
    name: "DEMO PRODUCT — Forged Upper Receiver",
    category: "upper-receiver",
    platform: "ar15",
    msrpCents: 12900,
    retailPriceCents: 11900,
    weightGrams: 255,
    lengthMm: 195,
    heightMm: 62,
    material: "7075-T6 aluminium",
    finish: "Hardcoat anodised",
    mountingInterface: "picatinny-1913",
    receiverInterface: "ar15-upper",
    barrelCompatibility: "ar15-barrel-extension",
    opticInterface: "footprint-picatinny",
    description: "Synthetic demo upper receiver with a continuous top rail.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
    extraDimensions: { railHeight: 12.7 },
  },
  {
    slug: "demo-forged-lower-receiver",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-LR-15",
    name: "DEMO PRODUCT — Forged Lower Receiver",
    category: "lower-receiver",
    platform: "ar15",
    msrpCents: 15900,
    retailPriceCents: 14900,
    weightGrams: 240,
    lengthMm: 200,
    heightMm: 85,
    material: "7075-T6 aluminium",
    finish: "Hardcoat anodised",
    receiverInterface: "ar15-lower",
    description: "Synthetic demo lower receiver. Serialized component in the demo data model.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "SERIALIZED_COMPONENT",
  },
  {
    slug: "demo-large-frame-upper-receiver",
    manufacturer: "demo-modular-systems",
    partNumber: "DMS-UR-10",
    name: "DEMO PRODUCT — Large Frame Upper Receiver",
    category: "upper-receiver",
    platform: "ar10",
    msrpCents: 19900,
    retailPriceCents: 18400,
    weightGrams: 340,
    lengthMm: 232,
    heightMm: 70,
    material: "7075-T6 aluminium",
    finish: "Hardcoat anodised",
    mountingInterface: "picatinny-1913",
    receiverInterface: "ar10-upper",
    barrelCompatibility: "ar10-barrel-extension",
    opticInterface: "footprint-picatinny",
    description: "Synthetic demo large-frame upper receiver.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-large-frame-lower-receiver",
    manufacturer: "demo-modular-systems",
    partNumber: "DMS-LR-10",
    name: "DEMO PRODUCT — Large Frame Lower Receiver",
    category: "lower-receiver",
    platform: "ar10",
    msrpCents: 23900,
    weightGrams: 330,
    lengthMm: 240,
    heightMm: 92,
    receiverInterface: "ar10-lower",
    material: "7075-T6 aluminium",
    description: "Synthetic demo large-frame lower receiver.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "LOW_STOCK",
    regulatoryClass: "SERIALIZED_COMPONENT",
  },

  // ---- Barrels ------------------------------------------------------------
  {
    slug: "demo-barrel-11-5",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-BBL-115",
    name: "DEMO PRODUCT — 11.5 in Barrel",
    category: "barrel",
    platform: "ar15",
    caliber: "5.56x45mm NATO",
    msrpCents: 21900,
    retailPriceCents: 19900,
    weightGrams: 640,
    lengthMm: 292.1,
    diameterMm: 19.05,
    material: "4150 CMV steel",
    finish: "Nitride",
    threadSpecification: "1-2x28",
    gasSystemCompatibility: "gas-carbine",
    barrelCompatibility: "ar15-barrel-extension",
    description: "Synthetic demo barrel, 11.5 in, carbine-length gas.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
    extraDimensions: { gasBlockJournal: 18.8, shoulderToMuzzle: 250 },
  },
  {
    slug: "demo-barrel-16",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-BBL-160",
    name: "DEMO PRODUCT — 16 in Barrel",
    category: "barrel",
    platform: "ar15",
    caliber: "5.56x45mm NATO",
    msrpCents: 24900,
    retailPriceCents: 22900,
    weightGrams: 850,
    lengthMm: 406.4,
    diameterMm: 19.05,
    material: "4150 CMV steel",
    finish: "Nitride",
    threadSpecification: "1-2x28",
    gasSystemCompatibility: "gas-mid",
    barrelCompatibility: "ar15-barrel-extension",
    description: "Synthetic demo barrel, 16 in, mid-length gas.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
    extraDimensions: { gasBlockJournal: 18.8 },
  },
  {
    slug: "demo-barrel-10-5",
    manufacturer: "demo-field-components",
    partNumber: "DFC-BBL-105",
    name: "DEMO PRODUCT — 10.5 in Barrel",
    category: "barrel",
    platform: "ar15",
    caliber: "300 BLK",
    msrpCents: 20900,
    weightGrams: 590,
    lengthMm: 266.7,
    diameterMm: 19.05,
    threadSpecification: "5-8x24",
    gasSystemCompatibility: "gas-pistol",
    barrelCompatibility: "ar15-barrel-extension",
    material: "4150 CMV steel",
    description: "Synthetic demo barrel, 10.5 in, pistol-length gas.",
    verificationStatus: "SECONDARY_SOURCE",
    availability: "BACKORDER",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-large-frame-barrel-18",
    manufacturer: "demo-modular-systems",
    partNumber: "DMS-BBL-180",
    name: "DEMO PRODUCT — 18 in Large Frame Barrel",
    category: "barrel",
    platform: "ar10",
    caliber: "6.5 Creedmoor",
    msrpCents: 41900,
    retailPriceCents: 39900,
    weightGrams: 1250,
    lengthMm: 457.2,
    diameterMm: 22.2,
    threadSpecification: "5-8x24",
    gasSystemCompatibility: "gas-rifle",
    barrelCompatibility: "ar10-barrel-extension",
    material: "416R stainless steel",
    description: "Synthetic demo large-frame barrel, 18 in, rifle-length gas.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },

  // ---- Handguards ---------------------------------------------------------
  {
    slug: "demo-handguard-13-mlok",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-HG-13",
    name: "DEMO PRODUCT — 13 in M-LOK Handguard",
    category: "handguard",
    platform: "ar15",
    msrpCents: 18900,
    retailPriceCents: 16900,
    weightGrams: 310,
    lengthMm: 330.2,
    diameterMm: 44.5,
    innerDiameterMm: 38.1,
    material: "6061-T6 aluminium",
    finish: "Hardcoat anodised",
    mountingInterface: "m-lok",
    handguardInterface: "ar15-barrel-nut-proprietary",
    description: "Synthetic demo free-float handguard with M-LOK slots.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
    extraDimensions: { barrelNutThread: 39.6 },
  },
  {
    slug: "demo-handguard-15-mlok",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-HG-15",
    name: "DEMO PRODUCT — 15 in M-LOK Handguard",
    category: "handguard",
    platform: "ar15",
    msrpCents: 20900,
    retailPriceCents: 19400,
    weightGrams: 350,
    lengthMm: 381,
    diameterMm: 44.5,
    innerDiameterMm: 38.1,
    material: "6061-T6 aluminium",
    mountingInterface: "m-lok",
    handguardInterface: "ar15-barrel-nut-proprietary",
    description:
      "Synthetic demo free-float handguard. Longer than the 11.5 in demo barrel, which the clearance engine reports as a documented conflict.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-handguard-9-keymod",
    manufacturer: "demo-field-components",
    partNumber: "DFC-HG-9",
    name: "DEMO PRODUCT — 9 in KeyMod Handguard",
    category: "handguard",
    platform: "ar15",
    msrpCents: 13900,
    weightGrams: 260,
    lengthMm: 228.6,
    mountingInterface: "keymod",
    handguardInterface: "ar15-barrel-nut-proprietary",
    description:
      "Synthetic demo handguard. The demo manufacturer publishes no inner bore dimension, so radial clearance resolves to UNKNOWN.",
    verificationStatus: "SECONDARY_SOURCE",
    availability: "UNKNOWN",
    regulatoryClass: "UNREGULATED_ACCESSORY",
    notes: "Intentionally missing innerDiameterMm and diameterMm.",
  },
  {
    slug: "demo-large-frame-handguard-15",
    manufacturer: "demo-modular-systems",
    partNumber: "DMS-HG-15",
    name: "DEMO PRODUCT — 15 in Large Frame Handguard",
    category: "handguard",
    platform: "ar10",
    msrpCents: 24900,
    weightGrams: 420,
    lengthMm: 381,
    diameterMm: 47.5,
    innerDiameterMm: 41.0,
    mountingInterface: "m-lok",
    handguardInterface: "ar15-barrel-nut-proprietary",
    description: "Synthetic demo large-frame handguard with M-LOK slots.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },

  // ---- Muzzle devices and suppressors -------------------------------------
  {
    slug: "demo-muzzle-device-a",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-MD-A1",
    name: "DEMO PRODUCT — Muzzle Device A",
    category: "muzzle-device",
    platform: "universal",
    msrpCents: 4900,
    retailPriceCents: 4200,
    weightGrams: 71,
    lengthMm: 55.9,
    diameterMm: 22.2,
    threadSpecification: "1-2x28",
    material: "17-4 stainless steel",
    description: "Synthetic demo muzzle device with a 1/2-28 thread.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-muzzle-device-qd",
    manufacturer: "demo-field-components",
    partNumber: "DFC-MD-QD",
    name: "DEMO PRODUCT — QD Muzzle Device",
    category: "muzzle-device",
    platform: "universal",
    msrpCents: 9900,
    retailPriceCents: 8900,
    weightGrams: 85,
    lengthMm: 60.0,
    diameterMm: 25.4,
    threadSpecification: "1-2x28",
    suppressorCompatibility: "suppressor-qd-taper",
    description: "Synthetic demo muzzle device documented as a suppressor mounting interface.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-muzzle-device-762",
    manufacturer: "demo-modular-systems",
    partNumber: "DMS-MD-762",
    name: "DEMO PRODUCT — Large Bore Muzzle Device",
    category: "muzzle-device",
    platform: "universal",
    msrpCents: 6900,
    weightGrams: 96,
    lengthMm: 66.0,
    diameterMm: 28.0,
    threadSpecification: "5-8x24",
    description: "Synthetic demo muzzle device with a 5/8-24 thread.",
    verificationStatus: "VERIFIED_DISTRIBUTOR",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-suppressor-qd",
    manufacturer: "demo-field-components",
    partNumber: "DFC-SUP-QD",
    name: "DEMO PRODUCT — QD Suppressor",
    category: "suppressor",
    platform: "universal",
    caliber: "5.56x45mm NATO",
    msrpCents: 89900,
    weightGrams: 400,
    lengthMm: 152.4,
    diameterMm: 38.1,
    innerDiameterMm: 26.0,
    suppressorCompatibility: "suppressor-qd-taper",
    material: "Stellite and stainless steel",
    description:
      "Synthetic demo suppressor. Regulated in the demo data model, so BuildSight links to the manufacturer's purchase process rather than offering checkout.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "NFA_ITEM",
  },
  {
    slug: "demo-suppressor-direct-thread",
    manufacturer: "demo-field-components",
    partNumber: "DFC-SUP-DT",
    name: "DEMO PRODUCT — Direct Thread Suppressor",
    category: "suppressor",
    platform: "universal",
    caliber: "5.56x45mm NATO",
    msrpCents: 74900,
    weightGrams: 365,
    lengthMm: 165.1,
    diameterMm: 36.8,
    innerDiameterMm: 24.0,
    threadSpecification: "1-2x28",
    suppressorCompatibility: "suppressor-direct-thread",
    description: "Synthetic demo direct-thread suppressor.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "LOW_STOCK",
    regulatoryClass: "NFA_ITEM",
  },

  // ---- Internals ----------------------------------------------------------
  {
    slug: "demo-bolt-carrier-group",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-BCG-15",
    name: "DEMO PRODUCT — Bolt Carrier Group",
    category: "bolt-carrier-group",
    platform: "ar15",
    caliber: "5.56x45mm NATO",
    msrpCents: 17900,
    retailPriceCents: 15900,
    weightGrams: 325,
    lengthMm: 178,
    material: "Carpenter 158 steel",
    finish: "Nitride",
    receiverInterface: "ar15-upper",
    description: "Synthetic demo bolt carrier group.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-large-frame-bolt-carrier-group",
    manufacturer: "demo-modular-systems",
    partNumber: "DMS-BCG-10",
    name: "DEMO PRODUCT — Large Frame Bolt Carrier Group",
    category: "bolt-carrier-group",
    platform: "ar10",
    caliber: "6.5 Creedmoor",
    msrpCents: 27900,
    weightGrams: 470,
    lengthMm: 200,
    receiverInterface: "ar10-upper",
    description: "Synthetic demo large-frame bolt carrier group.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-charging-handle",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-CH-15",
    name: "DEMO PRODUCT — Ambidextrous Charging Handle",
    category: "charging-handle",
    platform: "ar15",
    msrpCents: 7900,
    retailPriceCents: 6900,
    weightGrams: 45,
    lengthMm: 95,
    receiverInterface: "ar15-upper",
    description: "Synthetic demo charging handle.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-single-stage-trigger",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-TRG-1",
    name: "DEMO PRODUCT — Single Stage Trigger",
    category: "trigger",
    platform: "ar15",
    msrpCents: 12900,
    retailPriceCents: 11900,
    weightGrams: 105,
    lengthMm: 60,
    receiverInterface: "ar15-lower",
    description: "Synthetic demo drop-in trigger assembly.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-two-stage-trigger",
    manufacturer: "demo-field-components",
    partNumber: "DFC-TRG-2",
    name: "DEMO PRODUCT — Two Stage Trigger",
    category: "trigger",
    platform: "ar15",
    msrpCents: 19900,
    weightGrams: 128,
    lengthMm: 62,
    receiverInterface: "ar15-lower",
    description: "Synthetic demo two-stage trigger assembly.",
    verificationStatus: "USER_SUBMITTED",
    availability: "UNKNOWN",
    regulatoryClass: "UNREGULATED_ACCESSORY",
    notes: "User-submitted record; used to demonstrate low documentation confidence.",
  },

  // ---- Stock, buffer, grip ------------------------------------------------
  {
    slug: "demo-collapsible-stock",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-STK-M",
    name: "DEMO PRODUCT — Collapsible Stock",
    category: "stock",
    platform: "ar15",
    msrpCents: 8900,
    retailPriceCents: 7900,
    weightGrams: 240,
    lengthMm: 178,
    receiverInterface: "ar15-receiver-extension-mil-spec",
    mountingInterface: "qd-socket",
    description: "Synthetic demo collapsible stock for a mil-spec receiver extension.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-commercial-stock",
    manufacturer: "demo-field-components",
    partNumber: "DFC-STK-C",
    name: "DEMO PRODUCT — Commercial Stock",
    category: "stock",
    platform: "ar15",
    msrpCents: 6900,
    weightGrams: 230,
    lengthMm: 175,
    receiverInterface: "ar15-receiver-extension-commercial",
    description:
      "Synthetic demo stock for a commercial receiver extension. Pairing it with the mil-spec demo buffer system produces a documented interface mismatch.",
    verificationStatus: "VERIFIED_DISTRIBUTOR",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-buffer-system",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-BUF-MIL",
    name: "DEMO PRODUCT — Mil-Spec Buffer System",
    category: "buffer-system",
    platform: "ar15",
    msrpCents: 9900,
    retailPriceCents: 8900,
    weightGrams: 330,
    lengthMm: 190,
    diameterMm: 29.2,
    receiverInterface: "ar15-receiver-extension-mil-spec",
    description: "Synthetic demo receiver extension, buffer and spring.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-pistol-grip",
    manufacturer: "demo-precision-works",
    partNumber: "DPW-GRP-1",
    name: "DEMO PRODUCT — Pistol Grip",
    category: "grip",
    platform: "ar15",
    msrpCents: 3900,
    retailPriceCents: 3400,
    weightGrams: 85,
    lengthMm: 120,
    receiverInterface: "ar15-lower",
    description: "Synthetic demo pistol grip.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },

  // ---- Optics and mounts --------------------------------------------------
  {
    slug: "demo-micro-red-dot",
    manufacturer: "demo-optics-lab",
    partNumber: "DOL-RDS-1",
    name: "DEMO PRODUCT — Micro Red Dot",
    category: "optic",
    platform: "universal",
    msrpCents: 44900,
    retailPriceCents: 39900,
    weightGrams: 110,
    lengthMm: 68,
    widthMm: 41,
    heightMm: 40,
    opticInterface: "footprint-micro-t",
    description: "Synthetic demo micro red dot sight.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-mini-red-dot",
    manufacturer: "demo-optics-lab",
    partNumber: "DOL-RDS-2",
    name: "DEMO PRODUCT — Mini Red Dot",
    category: "optic",
    platform: "universal",
    msrpCents: 29900,
    weightGrams: 32,
    lengthMm: 45,
    widthMm: 25,
    heightMm: 24,
    opticInterface: "footprint-mini-b",
    description: "Synthetic demo mini red dot sight.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-low-power-variable-optic",
    manufacturer: "demo-optics-lab",
    partNumber: "DOL-LPVO-1",
    name: "DEMO PRODUCT — 1-6x Variable Optic",
    category: "optic",
    platform: "universal",
    msrpCents: 89900,
    retailPriceCents: 84900,
    weightGrams: 480,
    lengthMm: 260,
    diameterMm: 30,
    opticInterface: "footprint-30mm-tube",
    description: "Synthetic demo low-power variable optic with a 30 mm tube.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-micro-mount",
    manufacturer: "demo-optics-lab",
    partNumber: "DOL-MNT-MICRO",
    name: "DEMO PRODUCT — Micro Optic Mount",
    category: "mount",
    platform: "universal",
    msrpCents: 11900,
    retailPriceCents: 10900,
    weightGrams: 60,
    lengthMm: 52,
    heightMm: 38,
    mountingInterface: "picatinny-1913",
    opticInterface: "footprint-micro-t",
    description: "Synthetic demo mount for the micro red dot footprint.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-30mm-cantilever-mount",
    manufacturer: "demo-optics-lab",
    partNumber: "DOL-MNT-30",
    name: "DEMO PRODUCT — 30 mm Cantilever Mount",
    category: "mount",
    platform: "universal",
    msrpCents: 17900,
    weightGrams: 175,
    lengthMm: 110,
    heightMm: 44,
    mountingInterface: "picatinny-1913",
    opticInterface: "footprint-30mm-tube",
    description: "Synthetic demo cantilever mount for 30 mm tube optics.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },

  // ---- Accessories --------------------------------------------------------
  {
    slug: "demo-mlok-bipod",
    manufacturer: "demo-field-components",
    partNumber: "DFC-BPD-1",
    name: "DEMO PRODUCT — M-LOK Bipod",
    category: "bipod",
    platform: "universal",
    msrpCents: 15900,
    retailPriceCents: 13900,
    weightGrams: 320,
    lengthMm: 180,
    mountingInterface: "m-lok",
    description: "Synthetic demo bipod with a direct M-LOK interface.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-arca-bipod",
    manufacturer: "demo-field-components",
    partNumber: "DFC-BPD-ARCA",
    name: "DEMO PRODUCT — ARCA Bipod",
    category: "bipod",
    platform: "universal",
    msrpCents: 24900,
    weightGrams: 380,
    lengthMm: 200,
    mountingInterface: "arca-swiss",
    description:
      "Synthetic demo bipod with an ARCA clamp. Mounting it to an M-LOK demo handguard produces a documented interface mismatch.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-weapon-light",
    manufacturer: "demo-field-components",
    partNumber: "DFC-LGT-1",
    name: "DEMO PRODUCT — Weapon Light",
    category: "light",
    platform: "universal",
    msrpCents: 22900,
    retailPriceCents: 20900,
    weightGrams: 145,
    lengthMm: 95,
    diameterMm: 26,
    mountingInterface: "m-lok",
    description: "Synthetic demo weapon light with an M-LOK mount.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-qd-sling-mount",
    manufacturer: "demo-field-components",
    partNumber: "DFC-SLG-QD",
    name: "DEMO PRODUCT — QD Sling Mount",
    category: "sling-hardware",
    platform: "universal",
    msrpCents: 2900,
    weightGrams: 22,
    lengthMm: 30,
    mountingInterface: "m-lok",
    description: "Synthetic demo M-LOK sling socket.",
    verificationStatus: "VERIFIED_MANUFACTURER",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
  {
    slug: "demo-rail-panel-set",
    manufacturer: "demo-field-components",
    partNumber: "DFC-ACC-1",
    name: "DEMO PRODUCT — Rail Panel Set",
    category: "accessory",
    platform: "universal",
    msrpCents: 1900,
    weightGrams: 40,
    lengthMm: 150,
    mountingInterface: "m-lok",
    description: "Synthetic demo M-LOK panel set.",
    verificationStatus: "VERIFIED_DISTRIBUTOR",
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
  },
];

interface RuleSeed {
  name: string;
  kind: Prisma.CompatibilityRuleCreateInput["kind"];
  subjectCategorySlug?: string;
  targetCategorySlug?: string;
  subjectField?: string;
  targetField?: string;
  parameters?: Prisma.InputJsonValue;
  result: Prisma.CompatibilityRuleCreateInput["result"];
  explanation: string;
  condition?: string;
  priority?: number;
  verificationStatus?: Prisma.CompatibilityRuleCreateInput["verificationStatus"];
}

const RULES: RuleSeed[] = [
  {
    name: "Receiver pair shares a platform pattern",
    kind: "PLATFORM_MATCH",
    subjectCategorySlug: "upper-receiver",
    targetCategorySlug: "lower-receiver",
    subjectField: "platform",
    targetField: "platform",
    result: "COMPATIBLE",
    explanation:
      "Compatible — both receivers are documented for the same platform pattern.",
    parameters: {
      mismatchExplanation:
        "Incompatible — the receivers are documented for different platform patterns, which use different pin spacing and magazine wells.",
    },
  },
  {
    name: "Barrel extension matches the upper receiver",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "barrel",
    targetCategorySlug: "upper-receiver",
    subjectField: "barrelCompatibility",
    targetField: "barrelCompatibility",
    result: "COMPATIBLE",
    explanation:
      "Compatible — the barrel extension pattern published by both products is the same.",
  },
  {
    name: "Muzzle device thread matches the barrel thread",
    kind: "THREAD_MATCH",
    subjectCategorySlug: "muzzle-device",
    targetCategorySlug: "barrel",
    subjectField: "threadSpecification",
    targetField: "threadSpecification",
    result: "COMPATIBLE",
    explanation: "Compatible — both products publish the same muzzle thread specification.",
  },
  {
    name: "Suppressor mounts on a documented muzzle device",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "suppressor",
    targetCategorySlug: "muzzle-device",
    subjectField: "suppressorCompatibility",
    targetField: "suppressorCompatibility",
    result: "COMPATIBLE",
    explanation:
      "Compatible — the suppressor and the muzzle device publish the same mounting system.",
  },
  {
    name: "Direct-thread suppressor on a threaded barrel",
    kind: "THREAD_MATCH",
    subjectCategorySlug: "suppressor",
    targetCategorySlug: "barrel",
    subjectField: "threadSpecification",
    targetField: "threadSpecification",
    result: "CONDITIONAL",
    condition: "Applies only when no muzzle device occupies the barrel threads.",
    explanation:
      "Conditional — thread specifications match, and the manufacturer documents direct-thread mounting only when the barrel threads are otherwise unoccupied.",
    parameters: { skipIfCategoryPresent: ["muzzle-device"] },
    priority: 120,
  },
  {
    name: "Handguard mounts to a same-platform upper receiver",
    kind: "PLATFORM_MATCH",
    subjectCategorySlug: "handguard",
    targetCategorySlug: "upper-receiver",
    subjectField: "platform",
    targetField: "platform",
    result: "CONDITIONAL",
    condition:
      "Free-float handguards ship with a proprietary barrel nut; confirm the barrel nut and torque specification in the manufacturer's manual.",
    explanation:
      "Conditional — both products are documented for the same platform, and the handguard installs with its own barrel nut rather than a published receiver interface.",
  },
  {
    name: "Handguard must terminate behind the muzzle",
    kind: "DIMENSIONAL_CONSTRAINT",
    subjectCategorySlug: "handguard",
    targetCategorySlug: "barrel",
    parameters: {
      subjectDimension: "length",
      targetDimension: "length",
      comparison: "lte",
      offsetMm: -10,
      mismatchExplanation:
        "Documented dimensional conflict — the handguard is longer than the barrel it would mount over, so it would extend past the muzzle.",
    },
    result: "COMPATIBLE",
    explanation:
      "Compatible — published lengths leave the handguard terminating behind the muzzle.",
    priority: 90,
  },
  {
    name: "Optic footprint matches the mount",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "optic",
    targetCategorySlug: "mount",
    subjectField: "opticInterface",
    targetField: "opticInterface",
    result: "COMPATIBLE",
    explanation: "Compatible — the optic footprint and the mount footprint are the same.",
  },
  {
    name: "Mount clamps to the receiver rail",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "mount",
    targetCategorySlug: "upper-receiver",
    subjectField: "mountingInterface",
    targetField: "mountingInterface",
    result: "COMPATIBLE",
    explanation: "Compatible — the mount and the receiver publish the same rail interface.",
  },
  {
    name: "Optic clamps directly to the receiver rail",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "optic",
    targetCategorySlug: "upper-receiver",
    subjectField: "opticInterface",
    targetField: "opticInterface",
    result: "COMPATIBLE",
    explanation:
      "Compatible — the optic publishes a rail footprint matching the receiver's published rail interface.",
    parameters: {
      skipIfCategoryPresent: ["mount"],
      mismatchResult: "CONDITIONAL",
      mismatchExplanation:
        "Conditional — the optic's documented footprint is not the receiver's rail interface, so it needs a mount that publishes the same footprint.",
    },
    priority: 130,
  },
  {
    name: "Non-rail optics require a mount",
    kind: "REQUIRES_COMPONENT",
    subjectCategorySlug: "optic",
    parameters: { requiredCategorySlug: "mount" },
    result: "CONDITIONAL",
    condition: "Add a mount that publishes the same footprint as the optic.",
    explanation:
      "Conditional — the optic's documented footprint needs a mount, and this configuration does not contain one.",
  },
  {
    name: "Bipod attaches to the handguard interface",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "bipod",
    targetCategorySlug: "handguard",
    subjectField: "mountingInterface",
    targetField: "mountingInterface",
    result: "COMPATIBLE",
    explanation: "Compatible — both products publish the same accessory mounting interface.",
  },
  {
    name: "Light attaches to the handguard interface",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "light",
    targetCategorySlug: "handguard",
    subjectField: "mountingInterface",
    targetField: "mountingInterface",
    result: "COMPATIBLE",
    explanation: "Compatible — both products publish the same accessory mounting interface.",
  },
  {
    name: "Sling hardware attaches to the handguard interface",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "sling-hardware",
    targetCategorySlug: "handguard",
    subjectField: "mountingInterface",
    targetField: "mountingInterface",
    result: "COMPATIBLE",
    explanation: "Compatible — both products publish the same accessory mounting interface.",
  },
  {
    name: "Accessory attaches to the handguard interface",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "accessory",
    targetCategorySlug: "handguard",
    subjectField: "mountingInterface",
    targetField: "mountingInterface",
    result: "COMPATIBLE",
    explanation: "Compatible — both products publish the same accessory mounting interface.",
  },
  {
    name: "Stock matches the receiver extension",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "stock",
    targetCategorySlug: "buffer-system",
    subjectField: "receiverInterface",
    targetField: "receiverInterface",
    result: "COMPATIBLE",
    explanation:
      "Compatible — the stock and the receiver extension publish the same diameter specification.",
    parameters: {
      mismatchExplanation:
        "Incompatible — the stock and the receiver extension publish different diameter specifications, so the stock will not seat.",
    },
  },
  {
    name: "Buffer system matches the lower receiver platform",
    kind: "PLATFORM_MATCH",
    subjectCategorySlug: "buffer-system",
    targetCategorySlug: "lower-receiver",
    subjectField: "platform",
    targetField: "platform",
    result: "COMPATIBLE",
    explanation: "Compatible — both products are documented for the same platform pattern.",
  },
  {
    name: "Bolt carrier group matches the upper receiver",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "bolt-carrier-group",
    targetCategorySlug: "upper-receiver",
    subjectField: "receiverInterface",
    targetField: "receiverInterface",
    result: "COMPATIBLE",
    explanation: "Compatible — both products publish the same receiver interface.",
  },
  {
    name: "Bolt carrier group matches the barrel chambering",
    kind: "CALIBER_MATCH",
    subjectCategorySlug: "bolt-carrier-group",
    targetCategorySlug: "barrel",
    subjectField: "caliber",
    targetField: "caliber",
    result: "COMPATIBLE",
    explanation: "Compatible — the bolt and the barrel publish the same chambering.",
    parameters: {
      mismatchResult: "CONDITIONAL",
      mismatchExplanation:
        "Conditional — the published chamberings differ. Some cartridges share a bolt face; consult the manufacturer's documented bolt compatibility before assuming this pairing works.",
    },
  },
  {
    name: "Charging handle matches the upper receiver",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "charging-handle",
    targetCategorySlug: "upper-receiver",
    subjectField: "receiverInterface",
    targetField: "receiverInterface",
    result: "COMPATIBLE",
    explanation: "Compatible — both products publish the same receiver interface.",
  },
  {
    name: "Trigger matches the lower receiver",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "trigger",
    targetCategorySlug: "lower-receiver",
    subjectField: "receiverInterface",
    targetField: "receiverInterface",
    result: "COMPATIBLE",
    explanation: "Compatible — both products publish the same receiver interface.",
  },
  {
    name: "Grip matches the lower receiver",
    kind: "INTERFACE_MATCH",
    subjectCategorySlug: "grip",
    targetCategorySlug: "lower-receiver",
    subjectField: "receiverInterface",
    targetField: "receiverInterface",
    result: "COMPATIBLE",
    explanation: "Compatible — both products publish the same receiver interface.",
  },
];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

/** Deterministic PRNG so re-seeding produces the same demo price history. */
function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function resetCatalog() {
  // Ordered by dependency so foreign keys never block the reset.
  await prisma.importRecord.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.comparisonEntry.deleteMany();
  await prisma.savedComparison.deleteMany();
  await prisma.buildComponent.deleteMany();
  await prisma.build.deleteMany();
  await prisma.watchlistItem.deleteMany();
  await prisma.recentlyViewedProduct.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.savedSearch.deleteMany();
  await prisma.compatibilityRule.deleteMany();
  await prisma.price.deleteMany();
  await prisma.threeDAsset.deleteMany();
  await prisma.attachmentPoint.deleteMany();
  await prisma.dimension.deleteMany();
  await prisma.specification.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.manufacturer.deleteMany();
  await prisma.retailer.deleteMany();
  await prisma.category.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.auditLog.deleteMany();
}

async function seedCategories() {
  const ids = new Map<string, string>();
  for (const category of CATEGORIES.filter((c) => !c.parent)) {
    const created = await prisma.category.create({
      data: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
      },
    });
    ids.set(category.slug, created.id);
  }
  for (const category of CATEGORIES.filter((c) => c.parent)) {
    const created = await prisma.category.create({
      data: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        parentId: ids.get(category.parent as string) ?? null,
      },
    });
    ids.set(category.slug, created.id);
  }
  return ids;
}

async function main() {
  console.log("Resetting catalog…");
  await resetCatalog();

  console.log("Seeding categories…");
  const categoryIds = await seedCategories();

  console.log("Seeding data sources…");
  const demoSource = await prisma.dataSource.create({
    data: {
      slug: "demo-fixture",
      name: "BuildSight demo fixture",
      kind: "DEMO_FIXTURE",
      url: `${DOC}/buildsight/demo-catalog`,
      trustWeight: 100,
      notes:
        "Synthetic data used to demonstrate the platform. Not a manufacturer specification.",
    },
  });
  const manualSource = await prisma.dataSource.create({
    data: {
      slug: "manual-entry",
      name: "Admin manual entry",
      kind: "MANUAL_ENTRY",
      trustWeight: 60,
      notes: "Records typed into the admin catalog with a cited source URL.",
    },
  });

  console.log("Seeding manufacturers…");
  const manufacturerIds = new Map<string, string>();
  for (const manufacturer of MANUFACTURERS) {
    const created = await prisma.manufacturer.create({
      data: {
        slug: manufacturer.slug,
        name: manufacturer.name,
        website: `${DOC}/${manufacturer.slug}`,
        supportUrl: `${DOC}/${manufacturer.slug}/support`,
        country: manufacturer.country,
        description: manufacturer.description,
        isDemo: true,
      },
    });
    manufacturerIds.set(manufacturer.slug, created.id);
  }

  console.log("Seeding retailers…");
  const retailers = await Promise.all(
    [
      { slug: "demo-outfitters", name: "DEMO RETAILER — Outfitters" },
      { slug: "demo-supply-co", name: "DEMO RETAILER — Supply Co" },
    ].map((retailer) =>
      prisma.retailer.create({
        data: { ...retailer, website: `${DOC}/${retailer.slug}`, isDemo: true },
      }),
    ),
  );

  console.log(`Seeding ${PRODUCTS.length} products…`);
  const productIds = new Map<string, string>();
  const now = new Date();

  for (const [index, seed] of PRODUCTS.entries()) {
    const manufacturerId = manufacturerIds.get(seed.manufacturer);
    const categoryId = categoryIds.get(seed.category);
    if (!manufacturerId || !categoryId) {
      throw new Error(`Unresolved manufacturer or category for ${seed.partNumber}`);
    }
    const manufacturerName =
      MANUFACTURERS.find((m) => m.slug === seed.manufacturer)?.name ?? seed.manufacturer;

    const searchText = buildSearchText({
      productName: seed.name,
      manufacturerName,
      manufacturerPartNumber: seed.partNumber,
      categorySlug: seed.category,
      caliber: seed.caliber,
      platform: seed.platform,
      material: seed.material,
      finish: seed.finish,
      description: seed.description,
      lengthMm: seed.lengthMm,
      diameterMm: seed.diameterMm,
      mountingInterface: seed.mountingInterface,
      threadSpecification: seed.threadSpecification,
      gasSystemCompatibility: seed.gasSystemCompatibility,
      handguardInterface: seed.handguardInterface,
      receiverInterface: seed.receiverInterface,
      opticInterface: seed.opticInterface,
      suppressorCompatibility: seed.suppressorCompatibility,
      barrelCompatibility: seed.barrelCompatibility,
    });

    const lastVerified = new Date(now.getTime() - (index % 5) * 30 * 86_400_000);
    const quality = evaluateDataQuality(
      {
        manufacturerName,
        manufacturerPartNumber: seed.partNumber,
        productName: seed.name,
        categorySlug: seed.category,
        msrpCents: seed.msrpCents ?? null,
        currentPriceCents: seed.retailPriceCents ?? null,
        weightGrams: seed.weightGrams ?? null,
        lengthMm: seed.lengthMm ?? null,
        widthMm: seed.widthMm ?? null,
        heightMm: seed.heightMm ?? null,
        diameterMm: seed.diameterMm ?? null,
        innerDiameterMm: seed.innerDiameterMm ?? null,
        verificationStatus: seed.verificationStatus,
        sourceUrl: `${DOC}/${seed.manufacturer}/products/${seed.slug}`,
        productUrl: `${DOC}/${seed.manufacturer}/products/${seed.slug}`,
        manufacturerUrl: `${DOC}/${seed.manufacturer}`,
        lastVerified,
        priceCheckedAt: now,
      },
      { now },
    );

    const product = await prisma.product.create({
      data: {
        slug: seed.slug,
        manufacturerId,
        manufacturerPartNumber: seed.partNumber,
        productName: seed.name,
        categoryId,
        platform: seed.platform ?? null,
        caliber: seed.caliber ?? null,
        msrpCents: seed.msrpCents ?? null,
        weightGrams: seed.weightGrams ?? null,
        lengthMm: seed.lengthMm ?? null,
        widthMm: seed.widthMm ?? null,
        heightMm: seed.heightMm ?? null,
        diameterMm: seed.diameterMm ?? null,
        innerDiameterMm: seed.innerDiameterMm ?? null,
        material: seed.material ?? null,
        finish: seed.finish ?? null,
        mountingInterface: seed.mountingInterface ?? null,
        threadSpecification: seed.threadSpecification ?? null,
        gasSystemCompatibility: seed.gasSystemCompatibility ?? null,
        handguardInterface: seed.handguardInterface ?? null,
        receiverInterface: seed.receiverInterface ?? null,
        opticInterface: seed.opticInterface ?? null,
        suppressorCompatibility: seed.suppressorCompatibility ?? null,
        barrelCompatibility: seed.barrelCompatibility ?? null,
        description: seed.description,
        manufacturerUrl: `${DOC}/${seed.manufacturer}`,
        productUrl: `${DOC}/${seed.manufacturer}/products/${seed.slug}`,
        manualUrl: `${DOC}/${seed.manufacturer}/products/${seed.slug}/manual.pdf`,
        technicalDrawingUrl: `${DOC}/${seed.manufacturer}/products/${seed.slug}/drawing.pdf`,
        dataSourceId: demoSource.id,
        sourceUrl: `${DOC}/${seed.manufacturer}/products/${seed.slug}`,
        lastVerified,
        verificationStatus: seed.verificationStatus,
        availability: seed.availability,
        regulatoryClass: seed.regulatoryClass,
        publishState: "PUBLISHED",
        isDemo: true,
        dataQualityScore: quality.score,
        dataQualityIssues: quality.issues as unknown as Prisma.InputJsonValue,
        searchText,
      },
    });
    productIds.set(seed.slug, product.id);

    // Structured dimensions for the clearance engine.
    const dimensionRows: Prisma.DimensionCreateManyInput[] = [];
    for (const [kind, valueMm] of Object.entries(seed.extraDimensions ?? {})) {
      dimensionRows.push({
        productId: product.id,
        kind,
        label: kind.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
        valueMm: new Prisma.Decimal(valueMm),
        verificationStatus: seed.verificationStatus,
        sourceUrl: `${DOC}/${seed.manufacturer}/products/${seed.slug}`,
      });
    }
    if (dimensionRows.length) await prisma.dimension.createMany({ data: dimensionRows });

    // Named specifications, each carrying its own provenance.
    const specs: Array<[string, string, string, string | null]> = [];
    if (seed.material) specs.push(["material", "Material", seed.material, null]);
    if (seed.finish) specs.push(["finish", "Finish", seed.finish, null]);
    if (seed.caliber) specs.push(["caliber", "Caliber", seed.caliber, null]);
    if (seed.gasSystemCompatibility) {
      specs.push(["gasSystem", "Gas system", seed.gasSystemCompatibility, null]);
    }
    if (seed.threadSpecification) {
      specs.push(["thread", "Thread specification", seed.threadSpecification, null]);
    }
    if (specs.length) {
      await prisma.specification.createMany({
        data: specs.map(([key, label, value, unit]) => ({
          productId: product.id,
          key,
          label,
          value,
          unit,
          verificationStatus: seed.verificationStatus,
          dataSourceId: demoSource.id,
          sourceUrl: `${DOC}/${seed.manufacturer}/products/${seed.slug}`,
          lastVerified,
        })),
      });
    }

    // Placeholder geometry: generated from published dimensions only, and
    // always labelled as a visual approximation in the viewer.
    await prisma.threeDAsset.create({
      data: {
        productId: product.id,
        kind: "PLACEHOLDER_PRIMITIVE",
        isApproximate: true,
        lodLevel: 0,
        boundingBox: {
          lengthMm: seed.lengthMm ?? null,
          widthMm: seed.widthMm ?? seed.diameterMm ?? null,
          heightMm: seed.heightMm ?? seed.diameterMm ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    // Attachment points used by the 3D snapping system.
    const attachmentPoints: Prisma.AttachmentPointCreateManyInput[] = [];
    if (seed.mountingInterface) {
      attachmentPoints.push({
        productId: product.id,
        slug: "primary-mount",
        label: "Primary mounting interface",
        role: seed.category === "handguard" || seed.category === "upper-receiver" ? "PROVIDES" : "CONSUMES",
        interface: seed.mountingInterface,
        offsetXMm: new Prisma.Decimal(0),
        offsetYMm: new Prisma.Decimal(seed.category === "handguard" ? 22 : 0),
        offsetZMm: new Prisma.Decimal(0),
      });
    }
    if (seed.threadSpecification && seed.category === "barrel") {
      attachmentPoints.push({
        productId: product.id,
        slug: "muzzle-thread",
        label: "Muzzle thread",
        role: "PROVIDES",
        interface: seed.threadSpecification,
        offsetXMm: new Prisma.Decimal(seed.lengthMm ?? 0),
      });
    }
    if (attachmentPoints.length) {
      await prisma.attachmentPoint.createMany({ data: attachmentPoints });
    }

    // Pricing: a current observation per retailer plus 90 days of history.
    if (seed.msrpCents) {
      const random = mulberry32(index * 7919 + 13);
      const basePrice = seed.retailPriceCents ?? seed.msrpCents;
      const historyRows: Prisma.PriceCreateManyInput[] = [];
      for (let daysAgo = 90; daysAgo >= 1; daysAgo -= 1) {
        const drift = (random() - 0.48) * 0.06;
        const seasonal = Math.sin(daysAgo / 12) * 0.02;
        const amount = Math.round(basePrice * (1 + drift + seasonal));
        historyRows.push({
          productId: product.id,
          retailerId: retailers[index % retailers.length].id,
          amountCents: Math.max(100, amount),
          currency: "USD",
          availability: seed.availability,
          observedAt: new Date(now.getTime() - daysAgo * 86_400_000),
          checkedAt: new Date(now.getTime() - daysAgo * 86_400_000),
          isCurrent: false,
          productUrl: `${DOC}/${retailers[index % retailers.length].slug}/p/${seed.slug}`,
        });
      }
      await prisma.price.createMany({ data: historyRows });

      await prisma.price.createMany({
        data: retailers.map((retailer, retailerIndex) => ({
          productId: product.id,
          retailerId: retailer.id,
          amountCents: Math.round(basePrice * (retailerIndex === 0 ? 1 : 1.04)),
          currency: "USD",
          salePriceCents:
            retailerIndex === 0 && seed.retailPriceCents ? seed.retailPriceCents : null,
          availability: seed.availability,
          observedAt: now,
          checkedAt: now,
          isCurrent: true,
          productUrl: `${DOC}/${retailer.slug}/p/${seed.slug}`,
        })),
      });
    }
  }

  console.log(`Seeding ${RULES.length} compatibility rules…`);
  for (const rule of RULES) {
    await prisma.compatibilityRule.create({
      data: {
        name: rule.name,
        kind: rule.kind,
        subjectCategorySlug: rule.subjectCategorySlug ?? null,
        targetCategorySlug: rule.targetCategorySlug ?? null,
        subjectField: rule.subjectField ?? null,
        targetField: rule.targetField ?? null,
        parameters: rule.parameters ?? undefined,
        result: rule.result,
        explanation: rule.explanation,
        condition: rule.condition ?? null,
        priority: rule.priority ?? 100,
        verificationStatus: rule.verificationStatus ?? "VERIFIED_MANUFACTURER",
        sourceUrl: `${DOC}/buildsight/demo-catalog/rules`,
        isDemo: true,
      },
    });
  }

  // An explicit, product-specific pairing documented by the demo manufacturer.
  const qdSuppressor = productIds.get("demo-suppressor-qd");
  const qdMuzzleDevice = productIds.get("demo-muzzle-device-qd");
  if (qdSuppressor && qdMuzzleDevice) {
    await prisma.compatibilityRule.create({
      data: {
        name: "QD suppressor and QD muzzle device are a matched system",
        kind: "EXPLICIT_PAIR",
        subjectProductId: qdSuppressor,
        targetProductId: qdMuzzleDevice,
        result: "COMPATIBLE",
        explanation:
          "Compatible — the demo manufacturer documents these two products as a matched mounting system.",
        verificationStatus: "VERIFIED_MANUFACTURER",
        sourceUrl: `${DOC}/demo-field-components/products/demo-suppressor-qd`,
        priority: 10,
        isDemo: true,
      },
    });
  }

  console.log("Seeding accounts…");
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@buildsight.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin12345";
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", plan: "PRO_PLUS" },
    create: {
      email: adminEmail,
      name: "BuildSight Admin",
      passwordHash: await hashPassword(adminPassword),
      role: "ADMIN",
      plan: "PRO_PLUS",
    },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@buildsight.local" },
    update: { plan: "PRO" },
    create: {
      email: "demo@buildsight.local",
      name: "Demo Builder",
      passwordHash: await hashPassword("demo123456"),
      role: "USER",
      plan: "PRO",
    },
  });

  console.log("Seeding demo builds…");
  const componentsFor = (entries: Array<[string, string]>) =>
    entries
      .map(([slug, slotKey]) => {
        const productId = productIds.get(slug);
        return productId ? { productId, slotKey, quantity: 1 } : null;
      })
      .filter((value): value is { productId: string; slotKey: string; quantity: number } =>
        Boolean(value),
      );

  await prisma.build.create({
    data: {
      ownerId: demoUser.id,
      name: "16 in Range Configuration",
      description:
        "A complete demo configuration whose documented interfaces all resolve compatible.",
      platform: "ar15",
      caliber: "5.56x45mm NATO",
      components: {
        create: componentsFor([
          ["demo-forged-upper-receiver", "upper-receiver"],
          ["demo-forged-lower-receiver", "lower-receiver"],
          ["demo-barrel-16", "barrel"],
          ["demo-handguard-13-mlok", "handguard"],
          ["demo-muzzle-device-a", "muzzle-device"],
          ["demo-bolt-carrier-group", "bolt-carrier-group"],
          ["demo-charging-handle", "charging-handle"],
          ["demo-single-stage-trigger", "trigger"],
          ["demo-buffer-system", "buffer-system"],
          ["demo-collapsible-stock", "stock"],
          ["demo-pistol-grip", "grip"],
          ["demo-micro-red-dot", "optic"],
          ["demo-micro-mount", "mount"],
        ]),
      },
    },
  });

  await prisma.build.create({
    data: {
      ownerId: demoUser.id,
      name: "11.5 in Conflict Demonstration",
      description:
        "Deliberately pairs a 15 in handguard with an 11.5 in barrel to show a documented dimensional conflict, and an ARCA bipod against an M-LOK handguard to show an interface mismatch.",
      platform: "ar15",
      caliber: "5.56x45mm NATO",
      components: {
        create: componentsFor([
          ["demo-forged-upper-receiver", "upper-receiver"],
          ["demo-forged-lower-receiver", "lower-receiver"],
          ["demo-barrel-11-5", "barrel"],
          ["demo-handguard-15-mlok", "handguard"],
          ["demo-muzzle-device-a", "muzzle-device"],
          ["demo-bolt-carrier-group", "bolt-carrier-group"],
          ["demo-arca-bipod", "bipod"],
          ["demo-buffer-system", "buffer-system"],
          ["demo-commercial-stock", "stock"],
        ]),
      },
    },
  });

  console.log("Seeding watchlist, searches and notifications…");
  const watchedProducts = ["demo-barrel-16", "demo-micro-red-dot", "demo-handguard-13-mlok"]
    .map((slug) => productIds.get(slug))
    .filter((id): id is string => Boolean(id));
  for (const productId of watchedProducts) {
    const price = await prisma.price.findFirst({
      where: { productId, isCurrent: true },
      orderBy: { amountCents: "asc" },
    });
    await prisma.watchlistItem.create({
      data: {
        ownerId: demoUser.id,
        productId,
        targetPriceCents: price ? Math.round((price.salePriceCents ?? price.amountCents) * 0.9) : null,
        lastSeenPriceCents: price ? price.salePriceCents ?? price.amountCents : null,
      },
    });
  }

  await prisma.savedSearch.create({
    data: {
      ownerId: demoUser.id,
      name: "Lightweight M-LOK handguards",
      query: "m-lok handguard",
      filters: { categorySlug: "handguard", maxWeightGrams: 350 } as Prisma.InputJsonValue,
    },
  });

  await prisma.notification.create({
    data: {
      userId: demoUser.id,
      kind: "SYSTEM",
      title: "Welcome to BuildSight",
      body: "Your demo account is preloaded with two configurations and a watchlist. All catalog data is synthetic.",
      href: "/dashboard",
    },
  });

  console.log("Seeding an ingestion batch awaiting review…");
  const batch = await prisma.importBatch.create({
    data: {
      name: "Demo supplier feed — March",
      dataSourceId: manualSource.id,
      createdById: admin.id,
      state: "READY_FOR_REVIEW",
      notes: "Sample feed demonstrating normalisation, duplicate detection and missing-spec flags.",
      stats: { received: 3, needsReview: 2, duplicates: 1 } as Prisma.InputJsonValue,
    },
  });

  await prisma.importRecord.createMany({
    data: [
      {
        batchId: batch.id,
        state: "NEEDS_REVIEW",
        rawPayload: {
          manufacturer: "DEMO MANUFACTURER — Precision Works",
          part_number: "DPW-HG-11",
          name: "DEMO PRODUCT — 11 in M-LOK Handguard",
          category: "handguard",
          length: '11.0"',
          weight: "9.8 oz",
          price: "$179.00",
          source: `${DOC}/demo-precision-works/products/demo-handguard-11-mlok`,
        } as Prisma.InputJsonValue,
        normalized: {
          manufacturerPartNumber: "DPW-HG-11",
          productName: "DEMO PRODUCT — 11 in M-LOK Handguard",
          categorySlug: "handguard",
          lengthMm: 279.4,
          weightGrams: 277.8,
          msrpCents: 17900,
          mountingInterface: "m-lok",
        } as Prisma.InputJsonValue,
        issues: [
          {
            code: "MISSING_SPEC",
            severity: "WARNING",
            field: "innerDiameterMm",
            message: "Feed does not provide an inner bore dimension.",
          },
        ] as Prisma.InputJsonValue,
      },
      {
        batchId: batch.id,
        state: "DUPLICATE",
        rawPayload: {
          manufacturer: "DEMO MANUFACTURER — Precision Works",
          part_number: "DPW-HG-13",
          name: "DEMO PRODUCT — 13 in M-LOK Handguard",
          category: "handguard",
        } as Prisma.InputJsonValue,
        duplicateOfProductId: productIds.get("demo-handguard-13-mlok") ?? null,
        issues: [
          {
            code: "DUPLICATE_SKU",
            severity: "ERROR",
            field: "manufacturerPartNumber",
            message: "Matches an existing published product with the same manufacturer and part number.",
          },
        ] as Prisma.InputJsonValue,
      },
      {
        batchId: batch.id,
        state: "NEEDS_REVIEW",
        rawPayload: {
          manufacturer: "DEMO MANUFACTURER — Field Components",
          part_number: "DFC-MD-556B",
          name: "DEMO PRODUCT — Compensator B",
          category: "muzzle-device",
          length: "2400 mm",
          thread: "1/2-28",
        } as Prisma.InputJsonValue,
        normalized: {
          manufacturerPartNumber: "DFC-MD-556B",
          productName: "DEMO PRODUCT — Compensator B",
          categorySlug: "muzzle-device",
          lengthMm: 2400,
          threadSpecification: "1-2x28",
        } as Prisma.InputJsonValue,
        issues: [
          {
            code: "IMPLAUSIBLE_DIMENSION",
            severity: "WARNING",
            field: "lengthMm",
            message: "Recorded length is 2400 mm, beyond the 2000 mm plausibility limit — check the source units.",
          },
          {
            code: "MISSING_PRICE",
            severity: "INFO",
            field: "msrpCents",
            message: "No MSRP or observed retail price recorded.",
          },
        ] as Prisma.InputJsonValue,
      },
    ],
  });

  const counts = {
    manufacturers: await prisma.manufacturer.count(),
    products: await prisma.product.count(),
    rules: await prisma.compatibilityRule.count(),
    prices: await prisma.price.count(),
    builds: await prisma.build.count(),
  };
  console.log("Seed complete:", counts);
  console.log(`Admin sign-in: ${adminEmail} / ${adminPassword}`);
  console.log("Demo sign-in: demo@buildsight.local / demo123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
