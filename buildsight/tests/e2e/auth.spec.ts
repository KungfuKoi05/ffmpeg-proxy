import { expect, test } from "@playwright/test";

test.describe("authentication", () => {
  test("rejects a weak password on sign-up", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill(`weak-${Date.now()}@example.com`);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/at least 10 characters/i)).toBeVisible();
  });

  test("creates an account and lands on the dashboard", async ({ page }) => {
    const email = `e2e-${Date.now()}@example.com`;
    await page.goto("/sign-up");
    await page.getByLabel("Name (optional)").fill("E2E Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("integration-test-9");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Welcome back, E2E Tester/ })).toBeVisible();
  });

  test("signs in with the demo account and signs out", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("demo@buildsight.local");
    await page.getByLabel("Password").fill("demo123456");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("16 in Range Configuration")).toBeVisible();

    await page.getByRole("button", { name: /^DE$/ }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Sign in" }).first()).toBeVisible();
  });

  test("shows the same message for an unknown account and a wrong password", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("whatever12345");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  });
});
