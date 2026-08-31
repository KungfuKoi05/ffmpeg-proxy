import { expect, test } from "@playwright/test";

test.describe("API authorization and validation", () => {
  test("serves the public catalog without a session", async ({ request }) => {
    const response = await request.get("/api/products?q=barrel");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { products: unknown[] };
    expect(body.products.length).toBeGreaterThan(0);
  });

  test("requires a session for build endpoints", async ({ request }) => {
    const response = await request.get("/api/builds");
    expect(response.status()).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  // The session cookie is Secure in production builds, and only a browser
  // context applies the localhost exception — so authenticated API checks go
  // through `page.request` rather than the bare request fixture.
  test("requires an admin role for admin endpoints", async ({ page }) => {
    const signIn = await page.request.post("/api/auth/sign-in", {
      data: { email: "demo@buildsight.local", password: "demo123456" },
    });
    expect(signIn.status()).toBe(200);

    const response = await page.request.get("/api/admin/rules");
    expect(response.status()).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("validates request bodies", async ({ page }) => {
    await page.request.post("/api/auth/sign-in", {
      data: { email: "demo@buildsight.local", password: "demo123456" },
    });
    const response = await page.request.post("/api/builds", { data: { name: "" } });
    expect(response.status()).toBe(422);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  test("evaluates compatibility for an anonymous caller", async ({ request }) => {
    const products = await request.get("/api/products?category=barrel");
    const { products: rows } = (await products.json()) as { products: Array<{ id: string }> };

    const response = await request.post("/api/compatibility", {
      data: { platform: "ar15", components: [{ productId: rows[0].id }] },
    });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      compatibility: { overall: string; missingCoreCategories: string[] };
    };
    expect(body.compatibility.missingCoreCategories.length).toBeGreaterThan(0);
  });

  test("refuses a restricted assistant request before searching", async ({ request }) => {
    const response = await request.post("/api/scope", {
      data: { message: "give me the cnc program to machine a lower receiver" },
    });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      refusal: { category: string } | null;
      candidates: unknown[];
    };
    expect(body.refusal?.category).toBe("MACHINING");
    expect(body.candidates).toHaveLength(0);
  });

  test("rejects a cross-origin mutation", async ({ request }) => {
    const response = await request.post("/api/builds", {
      data: { name: "Cross origin" },
      headers: { origin: "https://evil.example" },
    });
    expect(response.status()).toBe(403);
  });
});
