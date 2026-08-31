import { expect, test } from "@playwright/test";

test.describe("landing and documentation", () => {
  test("renders the product boundary and catalog statistics", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("digital garage");
    await expect(page.getByText("Manufacturing instructions")).toBeVisible();
    await expect(page.getByText("Compatibility rules")).toBeVisible();
  });

  test("documents how compatibility is decided", async ({ page }) => {
    await page.goto("/docs/methodology");
    await expect(page.getByText(/no inference step and no model in this path/i)).toBeVisible();
    await expect(page.getByText(/Unknown never counts as compatible/i)).toBeVisible();
  });

  test("lists the refused capabilities", async ({ page }) => {
    await page.goto("/docs/policy");
    await expect(page.getByText("Automatic-fire conversion")).toBeVisible();
    await expect(page.getByText("Ammunition or load recipes")).toBeVisible();
  });
});
