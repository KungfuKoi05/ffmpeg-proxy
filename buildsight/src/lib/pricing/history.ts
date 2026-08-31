/** Price history statistics used by the product page and the cost engine. */

export interface PricePoint {
  observedAt: string;
  amountCents: number;
  retailer?: string | null;
}

export interface PriceStatistics {
  count: number;
  currentCents: number | null;
  lowestCents: number | null;
  highestCents: number | null;
  averageCents: number | null;
  /** Signed percentage difference between current and the window average. */
  changeVsAveragePercent: number | null;
  /** Signed percentage difference between the first and last observation. */
  trendPercent: number | null;
}

export function summarizePriceHistory(points: PricePoint[]): PriceStatistics {
  if (points.length === 0) {
    return {
      count: 0,
      currentCents: null,
      lowestCents: null,
      highestCents: null,
      averageCents: null,
      changeVsAveragePercent: null,
      trendPercent: null,
    };
  }

  const amounts = points.map((point) => point.amountCents);
  const current = amounts[amounts.length - 1];
  const first = amounts[0];
  const average = Math.round(amounts.reduce((sum, value) => sum + value, 0) / amounts.length);

  return {
    count: points.length,
    currentCents: current,
    lowestCents: Math.min(...amounts),
    highestCents: Math.max(...amounts),
    averageCents: average,
    changeVsAveragePercent: average > 0 ? round1(((current - average) / average) * 100) : null,
    trendPercent: first > 0 ? round1(((current - first) / first) * 100) : null,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Human phrasing used on the product page, e.g. "8% below the 90-day average". */
export function describePriceVsAverage(
  statistics: PriceStatistics,
  windowDays: number,
): string | null {
  if (statistics.changeVsAveragePercent === null) return null;
  const magnitude = Math.abs(statistics.changeVsAveragePercent);
  if (magnitude < 1) return `Current price matches the ${windowDays}-day average.`;
  const direction = statistics.changeVsAveragePercent < 0 ? "below" : "above";
  return `Current price is ${magnitude.toFixed(1)}% ${direction} the ${windowDays}-day average.`;
}

/** A date `days` before now. Wrapped so callers stay free of clock reads. */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}
