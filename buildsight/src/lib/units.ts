/**
 * Unit handling for BuildSight.
 *
 * The database stores canonical integer-friendly units (millimetres, grams,
 * minor currency units). Everything user-facing is converted here so that a
 * single rounding policy applies across the app, the exports and the PDFs.
 */

export const MM_PER_INCH = 25.4;
export const GRAMS_PER_OUNCE = 28.349523125;
export const OUNCES_PER_POUND = 16;

export type UnitSystem = "imperial" | "metric";

export const LENGTH_UNITS = ["mm", "cm", "m", "in", "ft"] as const;
export const MASS_UNITS = ["g", "kg", "oz", "lb"] as const;

export type LengthUnit = (typeof LENGTH_UNITS)[number];
export type MassUnit = (typeof MASS_UNITS)[number];

const LENGTH_TO_MM: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: MM_PER_INCH,
  ft: MM_PER_INCH * 12,
};

const MASS_TO_GRAMS: Record<MassUnit, number> = {
  g: 1,
  kg: 1000,
  oz: GRAMS_PER_OUNCE,
  lb: GRAMS_PER_OUNCE * OUNCES_PER_POUND,
};

export function isLengthUnit(unit: string): unit is LengthUnit {
  return (LENGTH_UNITS as readonly string[]).includes(unit);
}

export function isMassUnit(unit: string): unit is MassUnit {
  return (MASS_UNITS as readonly string[]).includes(unit);
}

export function toMm(value: number, unit: LengthUnit): number {
  return round(value * LENGTH_TO_MM[unit], 3);
}

export function fromMm(valueMm: number, unit: LengthUnit): number {
  return valueMm / LENGTH_TO_MM[unit];
}

export function toGrams(value: number, unit: MassUnit): number {
  return round(value * MASS_TO_GRAMS[unit], 3);
}

export function fromGrams(valueGrams: number, unit: MassUnit): number {
  return valueGrams / MASS_TO_GRAMS[unit];
}

export function mmToInches(valueMm: number): number {
  return valueMm / MM_PER_INCH;
}

export function inchesToMm(valueIn: number): number {
  return valueIn * MM_PER_INCH;
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  // `Number.EPSILON` nudging avoids 1.005 -> 1.00 style float artefacts.
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Format a canonical millimetre value for display. */
export function formatLength(
  valueMm: number | null | undefined,
  system: UnitSystem = "imperial",
  options: { decimals?: number; unitless?: boolean } = {},
): string {
  if (valueMm === null || valueMm === undefined || Number.isNaN(valueMm)) {
    return NOT_PROVIDED;
  }
  const decimals = options.decimals ?? (system === "imperial" ? 2 : 1);
  const value = system === "imperial" ? mmToInches(valueMm) : valueMm;
  const formatted = trimTrailingZeros(round(value, decimals).toFixed(decimals));
  if (options.unitless) return formatted;
  return `${formatted} ${system === "imperial" ? "in" : "mm"}`;
}

/** Format a canonical gram value for display. */
export function formatMass(
  valueGrams: number | null | undefined,
  system: UnitSystem = "imperial",
): string {
  if (valueGrams === null || valueGrams === undefined || Number.isNaN(valueGrams)) {
    return NOT_PROVIDED;
  }
  if (system === "metric") {
    return valueGrams >= 1000
      ? `${trimTrailingZeros(round(valueGrams / 1000, 2).toFixed(2))} kg`
      : `${trimTrailingZeros(round(valueGrams, 1).toFixed(1))} g`;
  }
  const ounces = fromGrams(valueGrams, "oz");
  if (ounces >= OUNCES_PER_POUND) {
    const pounds = Math.floor(ounces / OUNCES_PER_POUND);
    const remainder = round(ounces - pounds * OUNCES_PER_POUND, 1);
    return remainder > 0 ? `${pounds} lb ${trimTrailingZeros(remainder.toFixed(1))} oz` : `${pounds} lb`;
  }
  return `${trimTrailingZeros(round(ounces, 1).toFixed(1))} oz`;
}

export function formatMoney(
  amountCents: number | null | undefined,
  currency = "USD",
  options: { showCents?: boolean } = {},
): string {
  if (amountCents === null || amountCents === undefined || Number.isNaN(amountCents)) {
    return NOT_PROVIDED;
  }
  const showCents = options.showCents ?? true;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(amountCents / 100);
}

/** The single approved phrasing for an absent manufacturer specification. */
export const NOT_PROVIDED = "Not provided by manufacturer.";

const LENGTH_PATTERN =
  /^\s*(-?\d+(?:\.\d+)?)\s*(mm|millimet(?:er|re)s?|cm|centimet(?:er|re)s?|m|met(?:er|re)s?|in|inch(?:es)?|"|''|ft|feet|foot|')\s*$/i;

/**
 * Parse a human-entered length such as `11.5 in`, `16"` or `300mm` into
 * millimetres. Returns null when the input cannot be parsed unambiguously —
 * ingestion treats that as a validation failure rather than guessing.
 */
export function parseLengthToMm(input: string): number | null {
  const fraction = parseFractionalInches(input);
  if (fraction !== null) return round(fraction * MM_PER_INCH, 3);

  const match = LENGTH_PATTERN.exec(input);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  const unit = normalizeLengthUnit(match[2]);
  if (unit === null || Number.isNaN(value)) return null;
  return toMm(value, unit);
}

const MASS_PATTERN =
  /^\s*(-?\d+(?:\.\d+)?)\s*(g|grams?|kg|kilograms?|oz|ounces?|lbs?|pounds?)\s*$/i;

export function parseMassToGrams(input: string): number | null {
  const match = MASS_PATTERN.exec(input);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  const unit = normalizeMassUnit(match[2]);
  if (unit === null || Number.isNaN(value)) return null;
  return toGrams(value, unit);
}

/** Parse `1 1/2"` or `7/8 in` style imperial fractions. */
function parseFractionalInches(input: string): number | null {
  const match = /^\s*(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\s*(?:in|inch(?:es)?|"|'')\s*$/i.exec(input);
  if (!match) return null;
  const whole = match[1] ? Number.parseInt(match[1], 10) : 0;
  const numerator = Number.parseInt(match[2], 10);
  const denominator = Number.parseInt(match[3], 10);
  if (denominator === 0) return null;
  return whole + numerator / denominator;
}

function normalizeLengthUnit(raw: string): LengthUnit | null {
  const unit = raw.toLowerCase();
  if (["mm", "millimeter", "millimeters", "millimetre", "millimetres"].includes(unit)) return "mm";
  if (["cm", "centimeter", "centimeters", "centimetre", "centimetres"].includes(unit)) return "cm";
  if (["m", "meter", "meters", "metre", "metres"].includes(unit)) return "m";
  if (["in", "inch", "inches", '"', "''"].includes(unit)) return "in";
  if (["ft", "feet", "foot", "'"].includes(unit)) return "ft";
  return null;
}

function normalizeMassUnit(raw: string): MassUnit | null {
  const unit = raw.toLowerCase();
  if (["g", "gram", "grams"].includes(unit)) return "g";
  if (["kg", "kilogram", "kilograms"].includes(unit)) return "kg";
  if (["oz", "ounce", "ounces"].includes(unit)) return "oz";
  if (["lb", "lbs", "pound", "pounds"].includes(unit)) return "lb";
  return null;
}

export function trimTrailingZeros(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

/** Convert a Prisma Decimal | number | string | null into a plain number. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
