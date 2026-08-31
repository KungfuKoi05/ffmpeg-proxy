import { expect, test } from "@playwright/test";

test.describe("mobile layout", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "mobile emulation only");

  test("stacks the studio into switchable panels", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/studio");

    // The library is hidden until its panel is selected.
    await expect(page.getByLabel("Search the component library")).toBeHidden();

    await page.getByRole("button", { name: "library", exact: true }).click();
    await expect(page.getByLabel("Search the component library")).toBeVisible();

    await page.getByRole("button", { name: "inspector", exact: true }).click();
    await expect(page.getByText("Configuration inspector")).toBeVisible();
  });

  test("keeps the 3D viewport usable on a small screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/studio");
    await page.getByRole("button", { name: "library", exact: true }).click();
    await page.getByLabel("Search the component library").fill("16 in Barrel");
    await page.getByRole("button", { name: /^Add / }).first().click();

    await page.getByRole("button", { name: "viewport", exact: true }).click();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 20_000 });
  });

  test("opens the navigation menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByTestId("mobile-nav").getByRole("link", { name: "Catalog" }),
    ).toBeVisible();
  });
});
