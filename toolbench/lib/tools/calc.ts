/**
 * Calculators. Pure arithmetic, no rounding until display, and every function
 * that can be handed nonsense (zero denominators, negative principal) says so
 * rather than returning NaN or Infinity into a UI.
 */

export interface CalcResult {
  ok: boolean;
  error?: string;
}

/* --------------------------------------------------------- percentage ---- */

export function percentOf(percent: number, total: number): number {
  return (percent / 100) * total;
}

export function whatPercent(part: number, whole: number): CalcResult & { value?: number } {
  if (whole === 0) return { ok: false, error: "The total can't be zero." };
  return { ok: true, value: (part / whole) * 100 };
}

export function percentChange(from: number, to: number): CalcResult & {
  value?: number; direction?: "increase" | "decrease" | "none";
} {
  if (from === 0) {
    return { ok: false, error: "Percentage change from zero is undefined." };
  }
  const value = ((to - from) / Math.abs(from)) * 100;
  return {
    ok: true,
    value,
    direction: value > 0 ? "increase" : value < 0 ? "decrease" : "none",
  };
}

/* ----------------------------------------------------------- discount ---- */

export interface DiscountResult {
  finalPrice: number;
  saved: number;
  effectiveRate: number;
}

/** Applies discounts in sequence (30% then 20% is not 50%). */
export function applyDiscounts(price: number, percentages: number[]): DiscountResult {
  let running = price;
  for (const pct of percentages) running = running * (1 - pct / 100);
  const finalPrice = Math.max(0, running);
  const saved = price - finalPrice;
  return {
    finalPrice,
    saved,
    effectiveRate: price === 0 ? 0 : (saved / price) * 100,
  };
}

/* ------------------------------------------------------------- margin ---- */

export interface MarginResult {
  revenue: number;
  cost: number;
  profit: number;
  /** Profit as a share of revenue. */
  marginPercent: number;
  /** Profit as a share of cost. */
  markupPercent: number;
}

export function margin(revenue: number, cost: number): CalcResult & { value?: MarginResult } {
  if (revenue === 0) return { ok: false, error: "Revenue can't be zero." };
  const profit = revenue - cost;
  return {
    ok: true,
    value: {
      revenue, cost, profit,
      marginPercent: (profit / revenue) * 100,
      markupPercent: cost === 0 ? Infinity : (profit / cost) * 100,
    },
  };
}

/** The inverse: what to charge to hit a target margin. */
export function priceForMargin(cost: number, targetMarginPercent: number): CalcResult & { value?: number } {
  if (targetMarginPercent >= 100) {
    return { ok: false, error: "A margin of 100% or more is impossible — price would be infinite." };
  }
  return { ok: true, value: cost / (1 - targetMarginPercent / 100) };
}

/* --------------------------------------------------------------- loan ---- */

export interface LoanResult {
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
  schedule: { month: number; payment: number; principal: number; interest: number; balance: number }[];
}

export function loan(
  principal: number,
  annualRatePercent: number,
  years: number,
  opts: { scheduleMonths?: number } = {},
): CalcResult & { value?: LoanResult } {
  if (principal <= 0) return { ok: false, error: "Loan amount must be more than zero." };
  if (years <= 0) return { ok: false, error: "Term must be more than zero." };
  if (annualRatePercent < 0) return { ok: false, error: "Interest rate can't be negative." };

  const n = Math.round(years * 12);
  const r = annualRatePercent / 100 / 12;

  // A 0% loan is just principal split evenly -- the annuity formula divides by
  // zero there.
  const monthlyPayment = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));

  const schedule: LoanResult["schedule"] = [];
  const limit = Math.min(n, opts.scheduleMonths ?? n);
  let balance = principal;
  for (let month = 1; month <= limit; month++) {
    const interest = balance * r;
    const principalPart = monthlyPayment - interest;
    balance = Math.max(0, balance - principalPart);
    schedule.push({ month, payment: monthlyPayment, principal: principalPart, interest, balance });
  }

  const totalPaid = monthlyPayment * n;
  return {
    ok: true,
    value: { monthlyPayment, totalPaid, totalInterest: totalPaid - principal, schedule },
  };
}

/* -------------------------------------------------- compound interest ---- */

export interface CompoundResult {
  finalBalance: number;
  totalContributions: number;
  totalInterest: number;
  yearly: { year: number; balance: number; contributed: number; interest: number }[];
}

export function compoundInterest(input: {
  principal: number;
  annualRatePercent: number;
  years: number;
  compoundsPerYear?: number;
  monthlyContribution?: number;
}): CalcResult & { value?: CompoundResult } {
  const { principal, annualRatePercent, years } = input;
  const m = input.compoundsPerYear ?? 12;
  const contribution = input.monthlyContribution ?? 0;

  if (years <= 0) return { ok: false, error: "Years must be more than zero." };
  if (m <= 0) return { ok: false, error: "Compounds per year must be more than zero." };
  if (principal < 0) return { ok: false, error: "Starting amount can't be negative." };

  const r = annualRatePercent / 100;
  const periods = Math.round(years * m);
  const ratePerPeriod = r / m;
  // Contributions are monthly; convert to this compounding schedule.
  const contributionPerPeriod = contribution * (12 / m);

  let balance = principal;
  let contributed = principal;
  const yearly: CompoundResult["yearly"] = [];

  for (let p = 1; p <= periods; p++) {
    balance = balance * (1 + ratePerPeriod) + contributionPerPeriod;
    contributed += contributionPerPeriod;
    if (p % m === 0) {
      yearly.push({
        year: p / m,
        balance,
        contributed,
        interest: balance - contributed,
      });
    }
  }

  return {
    ok: true,
    value: {
      finalBalance: balance,
      totalContributions: contributed,
      totalInterest: balance - contributed,
      yearly,
    },
  };
}

/* ------------------------------------------------------------ salary ---- */

export interface SalaryResult {
  hourly: number; daily: number; weekly: number; biweekly: number;
  monthly: number; annual: number;
}

export function fromHourly(
  hourly: number,
  hoursPerWeek = 40,
  weeksPerYear = 52,
): CalcResult & { value?: SalaryResult } {
  if (hourly < 0 || hoursPerWeek <= 0 || weeksPerYear <= 0) {
    return { ok: false, error: "Hours and weeks must be more than zero." };
  }
  const annual = hourly * hoursPerWeek * weeksPerYear;
  return {
    ok: true,
    value: {
      hourly,
      daily: hourly * (hoursPerWeek / 5),
      weekly: hourly * hoursPerWeek,
      biweekly: hourly * hoursPerWeek * 2,
      monthly: annual / 12,
      annual,
    },
  };
}

export function fromAnnual(
  annual: number,
  hoursPerWeek = 40,
  weeksPerYear = 52,
): CalcResult & { value?: SalaryResult } {
  if (hoursPerWeek <= 0 || weeksPerYear <= 0) {
    return { ok: false, error: "Hours and weeks must be more than zero." };
  }
  return fromHourly(annual / (hoursPerWeek * weeksPerYear), hoursPerWeek, weeksPerYear);
}

/* ----------------------------------------------------------- material ---- */

/** Square footage from feet+inches, for any number of rectangular areas. */
export function areaSqFt(areas: { feet: number; inches?: number; widthFeet: number; widthInches?: number }[]): number {
  return areas.reduce((sum, a) => {
    const length = a.feet + (a.inches ?? 0) / 12;
    const width = a.widthFeet + (a.widthInches ?? 0) / 12;
    return sum + length * width;
  }, 0);
}

export interface PaintResult {
  totalSqFt: number;
  gallonsPerCoat: number;
  totalGallons: number;
  coats: number;
}

/** One US gallon covers ~350 sq ft per coat on primed drywall. */
export const PAINT_COVERAGE_SQFT_PER_GALLON = 350;

export function paint(input: {
  wallSqFt: number;
  coats?: number;
  doorsAndWindowsSqFt?: number;
}): CalcResult & { value?: PaintResult } {
  if (input.wallSqFt <= 0) return { ok: false, error: "Wall area must be more than zero." };
  const coats = input.coats ?? 2;
  if (coats <= 0) return { ok: false, error: "You need at least one coat." };

  const paintable = Math.max(0, input.wallSqFt - (input.doorsAndWindowsSqFt ?? 0));
  const gallonsPerCoat = paintable / PAINT_COVERAGE_SQFT_PER_GALLON;
  return {
    ok: true,
    value: {
      totalSqFt: paintable,
      gallonsPerCoat,
      totalGallons: gallonsPerCoat * coats,
      coats,
    },
  };
}

export interface ConcreteResult {
  cubicFeet: number;
  cubicYards: number;
  /** 60lb and 80lb premix bags, rounded up -- you can't buy 4.2 bags. */
  bags60lb: number;
  bags80lb: number;
}

const CUBIC_FEET_PER_60LB_BAG = 0.45;
const CUBIC_FEET_PER_80LB_BAG = 0.6;

export function concrete(input: {
  lengthFeet: number; widthFeet: number; thicknessInches: number; wastePercent?: number;
}): CalcResult & { value?: ConcreteResult } {
  const { lengthFeet, widthFeet, thicknessInches } = input;
  if (lengthFeet <= 0 || widthFeet <= 0 || thicknessInches <= 0) {
    return { ok: false, error: "Length, width and thickness must all be more than zero." };
  }
  const waste = 1 + (input.wastePercent ?? 10) / 100;
  const cubicFeet = lengthFeet * widthFeet * (thicknessInches / 12) * waste;
  return {
    ok: true,
    value: {
      cubicFeet,
      cubicYards: cubicFeet / 27,
      bags60lb: Math.ceil(cubicFeet / CUBIC_FEET_PER_60LB_BAG),
      bags80lb: Math.ceil(cubicFeet / CUBIC_FEET_PER_80LB_BAG),
    },
  };
}
