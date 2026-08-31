/**
 * End-to-end flow across the database and the engines:
 * create build → add components → validate compatibility → calculate cost and
 * weight → save → export.
 *
 * Runs against TEST_DATABASE_URL; the suite is skipped when it is not set so a
 * clean checkout can still run `npm test`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeIntegration = testDatabaseUrl ? describe : describe.skip;

// The server modules read DATABASE_URL when the Prisma client is constructed,
// so it must be pointed at the test database before they are imported.
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;

describeIntegration("build flow", () => {
  let db: typeof import("@/lib/db").prisma;
  let builds: typeof import("@/server/builds");
  let products: typeof import("@/server/products");
  let exports: typeof import("@/lib/export/build-sheet");
  let admin: typeof import("@/server/admin");
  let userId: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    db = (await import("@/lib/db")).prisma;
    builds = await import("@/server/builds");
    products = await import("@/server/products");
    exports = await import("@/lib/export/build-sheet");
    admin = await import("@/server/admin");

    // Reset the tables this suite touches.
    await db.watchlistItem.deleteMany();
    await db.recentlyViewedProduct.deleteMany();
    await db.notification.deleteMany();
    await db.buildComponent.deleteMany();
    await db.build.deleteMany();
    await db.compatibilityRule.deleteMany();
    await db.price.deleteMany();
    await db.product.deleteMany();
    await db.retailer.deleteMany();
    await db.manufacturer.deleteMany();
    await db.category.deleteMany();
    await db.user.deleteMany();

    const user = await db.user.create({
      data: {
        email: `integration-${Date.now()}@example.com`,
        passwordHash: "not-a-real-hash",
        plan: "FREE",
      },
    });
    userId = user.id;

    const manufacturer = await db.manufacturer.create({
      data: { slug: "test-mfg", name: "Test Manufacturer", isDemo: true },
    });

    const categories = await Promise.all(
      [
        ["upper-receiver", "Upper Receiver"],
        ["lower-receiver", "Lower Receiver"],
        ["barrel", "Barrel"],
        ["handguard", "Handguard"],
      ].map(([slug, name], index) =>
        db.category.create({ data: { slug, name, sortOrder: index } }),
      ),
    );
    const categoryId = (slug: string) =>
      categories.find((category) => category.slug === slug)!.id;

    const seed = [
      {
        slug: "test-upper",
        key: "upper",
        categorySlug: "upper-receiver",
        partNumber: "TM-UR",
        lengthMm: 195,
        weightGrams: 255,
        msrpCents: 12900,
        barrelCompatibility: "ar15-barrel-extension",
        searchText: "test upper receiver ar15",
      },
      {
        slug: "test-lower",
        key: "lower",
        categorySlug: "lower-receiver",
        partNumber: "TM-LR",
        lengthMm: 200,
        weightGrams: 240,
        msrpCents: 15900,
        searchText: "test lower receiver ar15",
      },
      {
        slug: "test-barrel-16",
        key: "barrel",
        categorySlug: "barrel",
        partNumber: "TM-BBL-16",
        lengthMm: 406.4,
        weightGrams: 850,
        msrpCents: 24900,
        barrelCompatibility: "ar15-barrel-extension",
        searchText: "test 16 in barrel 406.4 mm ar15 5.56",
      },
      {
        slug: "test-barrel-ar10",
        key: "ar10barrel",
        categorySlug: "barrel",
        partNumber: "TM-BBL-AR10",
        lengthMm: 457.2,
        weightGrams: 1250,
        msrpCents: 41900,
        barrelCompatibility: "ar10-barrel-extension",
        searchText: "test 18 in large frame barrel",
      },
    ];

    for (const entry of seed) {
      const product = await db.product.create({
        data: {
          slug: entry.slug,
          manufacturerId: manufacturer.id,
          manufacturerPartNumber: entry.partNumber,
          productName: `Test ${entry.key}`,
          categoryId: categoryId(entry.categorySlug),
          platform: "ar15",
          lengthMm: entry.lengthMm,
          weightGrams: entry.weightGrams,
          msrpCents: entry.msrpCents,
          barrelCompatibility: entry.barrelCompatibility ?? null,
          verificationStatus: "VERIFIED_MANUFACTURER",
          availability: "IN_STOCK",
          publishState: "PUBLISHED",
          sourceUrl: "https://example.com/spec",
          searchText: entry.searchText,
        },
      });
      ids[entry.key] = product.id;
    }

    // One retailer observation, below MSRP, so the cost engine prefers it.
    const retailer = await db.retailer.create({
      data: { slug: "test-retailer", name: "Test Retailer", isDemo: true },
    });
    await db.price.create({
      data: {
        productId: ids.barrel,
        retailerId: retailer.id,
        amountCents: 22900,
        isCurrent: true,
      },
    });

    await db.compatibilityRule.create({
      data: {
        name: "Barrel extension matches the upper receiver",
        kind: "INTERFACE_MATCH",
        subjectCategorySlug: "barrel",
        targetCategorySlug: "upper-receiver",
        subjectField: "barrelCompatibility",
        targetField: "barrelCompatibility",
        result: "COMPATIBLE",
        explanation: "Compatible — the barrel extension pattern published by both products is the same.",
        verificationStatus: "VERIFIED_MANUFACTURER",
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("creates a build, adds components and computes a summary", async () => {
    const build = await builds.createBuild(userId, {
      name: "Integration configuration",
      platform: "ar15",
      components: [{ productId: ids.upper }, { productId: ids.lower }],
    });
    expect(build.components).toHaveLength(2);

    const withBarrel = await builds.addComponent(build.id, userId, { productId: ids.barrel });
    expect(withBarrel.components).toHaveLength(3);

    const summary = await builds.summarizeBuildRecord(withBarrel);

    // Cost prefers the observed retail price over MSRP.
    expect(summary.cost.totalCurrentCents).toBe(12900 + 15900 + 22900);
    expect(summary.weight.totalGrams).toBe(255 + 240 + 850);
    expect(summary.dimensions.overallLengthMm).toBeCloseTo(195 + 406.4, 2);

    const barrelFinding = summary.compatibility.findings.find(
      (finding) => finding.ruleName === "Barrel extension matches the upper receiver",
    );
    expect(barrelFinding?.state).toBe("COMPATIBLE");
  });

  it("replaces the occupant of a single-occupancy slot", async () => {
    const build = await builds.createBuild(userId, {
      name: "Swap configuration",
      platform: "ar15",
      components: [{ productId: ids.upper }, { productId: ids.barrel }],
    });

    const swapped = await builds.addComponent(build.id, userId, { productId: ids.ar10barrel });
    const barrels = swapped.components.filter((entry) => entry.slotKey === "barrel");
    expect(barrels).toHaveLength(1);
    expect(barrels[0].productId).toBe(ids.ar10barrel);

    // The mismatched barrel extension is now a documented conflict.
    const summary = await builds.summarizeBuildRecord(swapped);
    expect(summary.compatibility.overall).toBe("INCOMPATIBLE");
  });

  it("removes a component and recomputes", async () => {
    const build = await builds.createBuild(userId, {
      name: "Removal configuration",
      platform: "ar15",
      components: [{ productId: ids.upper }, { productId: ids.barrel }],
    });
    const target = build.components.find((entry) => entry.slotKey === "barrel")!;
    const updated = await builds.removeComponent(build.id, userId, target.id);

    expect(updated.components).toHaveLength(1);
    const summary = await builds.summarizeBuildRecord(updated);
    expect(summary.weight.totalGrams).toBe(255);
  });

  it("duplicates a build with all of its components", async () => {
    const build = await builds.createBuild(userId, {
      name: "Original",
      platform: "ar15",
      components: [{ productId: ids.upper }, { productId: ids.barrel }],
    });
    const copy = await builds.duplicateBuild(build.id, userId);

    expect(copy.name).toBe("Original (copy)");
    expect(copy.components).toHaveLength(2);
    expect(copy.id).not.toBe(build.id);
  });

  it("exports the saved build as CSV, JSON and PDF", async () => {
    const build = await builds.createBuild(userId, {
      name: "Export configuration",
      platform: "ar15",
      components: [{ productId: ids.upper }, { productId: ids.barrel }],
    });
    const summary = await builds.summarizeBuildRecord(build);
    const input = {
      build: {
        id: build.id,
        name: build.name,
        description: build.description,
        platform: build.platform,
        caliber: build.caliber,
        createdAt: build.createdAt.toISOString(),
        updatedAt: build.updatedAt.toISOString(),
        ownerName: null,
      },
      components: builds.toAssemblyInput(build).components,
      summary,
    };

    const csv = exports.buildPartsCsv(input);
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv).toContain("TM-BBL-16");

    const json = JSON.parse(exports.buildConfigurationJson(input)) as { components: unknown[] };
    expect(json.components).toHaveLength(2);

    const pdf = new TextDecoder().decode(exports.buildSheetPdf(input));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("Export configuration");
  });

  it("enforces the free plan's saved build quota", async () => {
    await db.build.deleteMany({ where: { ownerId: userId } });
    for (let index = 0; index < 5; index += 1) {
      await builds.createBuild(userId, { name: `Quota ${index}` });
    }
    await expect(builds.assertBuildQuota(userId, "FREE")).rejects.toThrow(/5 saved builds/);
    await expect(builds.assertBuildQuota(userId, "PRO")).resolves.toBeUndefined();
  });

  it("refuses to load another user's build", async () => {
    const build = await builds.createBuild(userId, { name: "Private" });
    const other = await db.user.create({
      data: { email: `other-${Date.now()}@example.com`, passwordHash: "x" },
    });
    await expect(builds.getBuildForUser(build.id, other.id)).rejects.toThrow(/not found/i);
  });

  it("finds products by full-text search", async () => {
    const result = await products.searchProducts({ q: "16 in barrel" });
    expect(result.products.map((product) => product.slug)).toContain("test-barrel-16");
  });

  it("filters the catalog by category and platform", async () => {
    const result = await products.searchProducts({ categorySlug: "barrel", platform: "ar15" });
    expect(result.total).toBe(2);
  });

  it("recomputes derived fields after a catalog write", async () => {
    await db.product.update({
      where: { id: ids.barrel },
      data: { lengthMm: null, searchText: "" },
    });
    await admin.refreshDerivedProductFields(ids.barrel);

    const updated = await db.product.findUniqueOrThrow({ where: { id: ids.barrel } });
    expect(updated.searchText).toContain("Test barrel");
    expect(updated.dataQualityScore).toBeLessThan(100);
    const issues = (updated.dataQualityIssues ?? []) as Array<{ code: string }>;
    expect(issues.map((issue) => issue.code)).toContain("MISSING_LENGTH");
  });
});
