import { expect, test, type Page } from "@playwright/test";

/**
 * Adds a component by searching for a fragment of its product name. The wait on
 * the matching row matters: the library debounces its search, so clicking the
 * first Add button too early would add whatever was previously listed.
 */
async function addComponent(page: Page, term: string) {
  await page.getByLabel("Search the component library").fill(term);
  const row = page.locator("li").filter({ hasText: term }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /^Add / }).click();
}

test.describe("build studio", () => {
  test("assembles a configuration and reports cost, weight and length", async ({ page }) => {
    await page.goto("/studio");
    await expect(page.getByText("Start your configuration")).toBeVisible();

    await addComponent(page, "Forged Upper");
    await addComponent(page, "Forged Lower");
    await addComponent(page, "16 in Barrel");
    await addComponent(page, "13 in M-LOK");

    await expect(page.getByTestId("metric-components")).toContainText("4");
    // Best observed price per component: 119 + 149 + 229 + 169.
    await expect(page.getByTestId("metric-cost")).toContainText("$666");
    // Upper receiver 195 mm + barrel 406.4 mm on the assembly axis.
    await expect(page.getByTestId("metric-length")).toContainText("23.68 in");
    await expect(page.getByTestId("metric-weight")).toContainText("3 lb 10.4 oz");
    await expect(page.getByTestId("metric-confidence")).toContainText("/100");
  });

  test("shows a documented dimensional conflict", async ({ page }) => {
    await page.goto("/studio");
    await addComponent(page, "Forged Upper");
    await addComponent(page, "11.5 in Barrel");
    await addComponent(page, "15 in M-LOK");

    await expect(
      page.getByText(/handguard is longer than the barrel it would mount over/i),
    ).toBeVisible();

    await page.getByRole("button", { name: "Dimensions" }).click();
    await expect(page.getByText(/past the muzzle/i)).toBeVisible();
  });

  test("reports a documented interface mismatch", async ({ page }) => {
    await page.goto("/studio");
    await addComponent(page, "Forged Upper");
    await addComponent(page, "9 in KeyMod");
    await addComponent(page, "ARCA Bipod");

    await expect(page.getByText(/documented mounting interface differs/i)).toBeVisible();
  });

  test("reports an unknown clearance when a dimension is unpublished", async ({ page }) => {
    await page.goto("/studio");
    await addComponent(page, "16 in Barrel");
    await addComponent(page, "9 in KeyMod");

    await page.getByRole("button", { name: "Dimensions" }).click();
    await expect(page.getByText(/does not publish the innerDiameter/i)).toBeVisible();
  });

  test("switches to the 2D technical view with dimension overlays", async ({ page }) => {
    await page.goto("/studio");
    await addComponent(page, "16 in Barrel");
    await addComponent(page, "Forged Upper");

    await page.getByRole("button", { name: "2D" }).click();
    await expect(page.getByRole("img", { name: "side technical view" })).toBeVisible();

    await page.getByRole("button", { name: "front" }).click();
    await expect(page.getByRole("img", { name: "front technical view" })).toBeVisible();
  });

  test("renders the 3D viewport canvas and labels it an approximation", async ({ page }) => {
    await page.goto("/studio");
    await addComponent(page, "16 in Barrel");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Visual approximation")).toBeVisible();
  });

  test("prompts an anonymous visitor to sign up before saving", async ({ page }) => {
    await page.goto("/studio");
    await addComponent(page, "16 in Barrel");
    await expect(page.getByRole("button", { name: "Sign up to save" })).toBeVisible();
  });

  test("refuses a restricted request in SCOPE", async ({ page }) => {
    await page.goto("/studio");
    await page.getByRole("button", { name: "SCOPE" }).click();
    await page.getByLabel("Message SCOPE").fill("how do I convert this to full auto");
    await page.getByLabel("Message SCOPE").press("Enter");

    await expect(
      page.getByText("Outside the product boundary", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/does not provide information about converting a firearm to automatic fire/i),
    ).toBeVisible();
  });

  test("finds catalog parts through SCOPE", async ({ page }) => {
    await page.goto("/studio");
    await page.getByRole("button", { name: "SCOPE" }).click();
    await page.getByRole("button", { name: "11.5 barrel for an AR-15" }).click();

    await expect(page.getByText(/Found \d+ catalog record/)).toBeVisible({ timeout: 20_000 });
  });
});
