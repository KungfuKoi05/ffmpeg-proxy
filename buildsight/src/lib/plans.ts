/**
 * Plan entitlements.
 *
 * A single table drives pricing copy, server-side enforcement and the upgrade
 * prompts, so a limit can never be advertised in one place and enforced
 * differently in another.
 */

import type { Plan } from "@prisma/client";

export interface PlanEntitlements {
  id: Plan;
  name: string;
  priceCents: number | null;
  cadence: "month" | "custom";
  tagline: string;
  /** null means unlimited. */
  maxBuilds: number | null;
  maxWatchlistItems: number | null;
  maxSavedComparisons: number | null;
  compareLimit: number;
  pdfExport: boolean;
  csvExport: boolean;
  priceTracking: boolean;
  priceHistoryDays: number;
  advancedVisualization: boolean;
  buildAnalytics: boolean;
  manufacturerPortal: boolean;
  features: string[];
}

export const PLANS: Record<Plan, PlanEntitlements> = {
  FREE: {
    id: "FREE",
    name: "Free",
    priceCents: 0,
    cadence: "month",
    tagline: "Explore the catalog and keep a few builds.",
    maxBuilds: 5,
    maxWatchlistItems: 10,
    maxSavedComparisons: 1,
    compareLimit: 2,
    pdfExport: false,
    csvExport: true,
    priceTracking: false,
    priceHistoryDays: 30,
    advancedVisualization: false,
    buildAnalytics: false,
    manufacturerPortal: false,
    features: [
      "5 saved builds",
      "Full component catalog",
      "3D visualization with exploded view",
      "Compatibility and clearance checks",
      "CSV and JSON export",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceCents: 999,
    cadence: "month",
    tagline: "For enthusiasts maintaining several configurations.",
    maxBuilds: null,
    maxWatchlistItems: 200,
    maxSavedComparisons: 25,
    compareLimit: 4,
    pdfExport: true,
    csvExport: true,
    priceTracking: true,
    priceHistoryDays: 90,
    advancedVisualization: true,
    buildAnalytics: false,
    manufacturerPortal: false,
    features: [
      "Unlimited saved builds",
      "Compare up to 4 configurations",
      "Price tracking and watchlist alerts",
      "PDF build sheets",
      "X-ray, measurement and section views",
    ],
  },
  PRO_PLUS: {
    id: "PRO_PLUS",
    name: "Pro+",
    priceCents: 1999,
    cadence: "month",
    tagline: "Deeper analytics and longer price history.",
    maxBuilds: null,
    maxWatchlistItems: null,
    maxSavedComparisons: null,
    compareLimit: 4,
    pdfExport: true,
    csvExport: true,
    priceTracking: true,
    priceHistoryDays: 730,
    advancedVisualization: true,
    buildAnalytics: true,
    manufacturerPortal: false,
    features: [
      "Everything in Pro",
      "Configuration analytics and score history",
      "Two years of observed pricing",
      "Priority catalog updates",
      "Advanced visualization tools",
    ],
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    priceCents: null,
    cadence: "custom",
    tagline: "For manufacturers and retailers publishing catalog data.",
    maxBuilds: null,
    maxWatchlistItems: null,
    maxSavedComparisons: null,
    compareLimit: 4,
    pdfExport: true,
    csvExport: true,
    priceTracking: true,
    priceHistoryDays: 730,
    advancedVisualization: true,
    buildAnalytics: true,
    manufacturerPortal: true,
    features: [
      "Manufacturer profile and verified product badge",
      "Catalog management and bulk import",
      "Product visualization for your own SKUs",
      "Listing analytics",
    ],
  },
};

export const PLAN_ORDER: Plan[] = ["FREE", "PRO", "PRO_PLUS", "BUSINESS"];

export function entitlements(plan: Plan): PlanEntitlements {
  return PLANS[plan] ?? PLANS.FREE;
}

export class PlanLimitError extends Error {
  readonly status = 402;
  constructor(
    message: string,
    readonly limit: string,
  ) {
    super(message);
    this.name = "PlanLimitError";
  }
}
