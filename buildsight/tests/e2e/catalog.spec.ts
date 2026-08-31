import { expect, test } from "@playwright/test";

test.describe("catalog", () => {
  test("finds a product by a partial, unit-less query", async ({ page }) => {
    await page.goto("/catalog?q=11.5+barrel");
    await expect(page.getByText("DEMO PRODUCT — 11.5 in Barrel")).toBeVisible();
  });

  test("filters by category", async ({ page }) => {
    await page.goto("/catalog?category=handguard");
    await expect(page.getByText("DEMO PRODUCT — 13 in M-LOK Handguard")).toBeVisible();
    await expect(page.getByText("DEMO PRODUCT — 16 in Barrel")).toHaveCount(0);
  });

  test("shows published specifications, sources and gaps on a product page", async ({ page }) => {
    await page.goto("/catalog/demo-handguard-9-keymod");

    await expect(page.getByRole("heading", { name: /9 in KeyMod Handguard/ })).toBeVisible();
    await expect(page.getByText("Secondary source").first()).toBeVisible();
    // The demo record deliberately omits the bore dimension.
    await expect(page.getByText("Not provided").first()).toBeVisible();
    await expect(page.getByText("Compatibility rules referencing this component")).toBeVisible();
  });

  test("labels regulated products and links to the manufacturer's process", async ({ page }) => {
    await page.goto("/catalog/demo-suppressor-qd");
    await expect(page.getByText("Regulated item").first()).toBeVisible();
    await expect(page.getByText(/never automates a purchase/i)).toBeVisible();
  });

  test("reports no results honestly", async ({ page }) => {
    await page.goto("/catalog?q=zzzz-no-such-product");
    await expect(page.getByText("No catalog records match those filters")).toBeVisible();
  });
});
