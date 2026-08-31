import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits, clientKey } from "@/lib/api/rate-limit";
import { assertSameOrigin, CrossOriginError } from "@/lib/api/guards";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

describe("rate limiting", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests up to the limit and rejects the next one", () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(rateLimit("key", 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit("key", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("keys separate callers independently", () => {
    expect(rateLimit("a", 1, 60_000).ok).toBe(true);
    expect(rateLimit("b", 1, 60_000).ok).toBe(true);
    expect(rateLimit("a", 1, 60_000).ok).toBe(false);
  });

  it("derives a key from the forwarded client address", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientKey(request, "scope")).toBe("scope:203.0.113.7");
  });
});

describe("cross-origin protection", () => {
  it("allows same-origin mutations", () => {
    const request = new Request("https://app.example/api/builds", {
      method: "POST",
      headers: { origin: "https://app.example", host: "app.example" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects a cross-origin mutation", () => {
    const request = new Request("https://app.example/api/builds", {
      method: "POST",
      headers: { origin: "https://evil.example", host: "app.example" },
    });
    expect(() => assertSameOrigin(request)).toThrow(CrossOriginError);
  });

  it("ignores the check for safe methods", () => {
    const request = new Request("https://app.example/api/products", {
      method: "GET",
      headers: { origin: "https://evil.example", host: "app.example" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });
});

describe("passwords", () => {
  it("enforces the credential policy", () => {
    expect(checkPasswordPolicy("short1").ok).toBe(false);
    expect(checkPasswordPolicy("noDigitsHere").ok).toBe(false);
    expect(checkPasswordPolicy("1234567890").ok).toBe(false);
    expect(checkPasswordPolicy("correct-horse-9").ok).toBe(true);
  });

  it("hashes and verifies without storing the password", async () => {
    const hash = await hashPassword("correct-horse-9");
    expect(hash).not.toContain("correct-horse-9");
    expect(await verifyPassword("correct-horse-9", hash)).toBe(true);
    expect(await verifyPassword("wrong-password-1", hash)).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a signed session", async () => {
    const token = await createSessionToken("user-123");
    expect(await verifySessionToken(token)).toBe("user-123");
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken("user-123");
    const tampered = `${token.slice(0, -3)}abc`;
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const original = process.env.AUTH_SECRET;
    const token = await createSessionToken("user-123");
    process.env.AUTH_SECRET = "a-completely-different-secret-value-32-chars";
    expect(await verifySessionToken(token)).toBeNull();
    process.env.AUTH_SECRET = original;
  });
});
