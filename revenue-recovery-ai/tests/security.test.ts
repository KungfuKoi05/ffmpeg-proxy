import { describe, expect, it, beforeEach } from "vitest";
import twilio from "twilio";
import { AppError, toPublicError, withTimeout, withRetry } from "@/lib/errors";
import { checkRateLimit, resetRateLimits } from "@/lib/security/rate-limit";
import { verifyTwilioSignature } from "@/lib/twilio/verify";

describe("error surface", () => {
  it("never leaks internal detail to clients", () => {
    const err = new AppError("TENANT_MISMATCH", { businessId: "secret-uuid" });
    const { body, status } = toPublicError(err);
    expect(status).toBe(403);
    expect(JSON.stringify(body)).not.toContain("secret-uuid");
    expect(body.error.message).toBe("You do not have access to this resource.");
  });

  it("maps an unknown throw to a generic 500", () => {
    const { body, status } = toPublicError(new Error("stack trace with /home/user/secrets"));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("/home/user/secrets");
  });
});

describe("withTimeout", () => {
  it("rejects with UPSTREAM_TIMEOUT when the promise is slow", async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200));
    await expect(withTimeout(slow, 20, "test")).rejects.toMatchObject({
      code: "UPSTREAM_TIMEOUT",
    });
  });

  it("passes a fast promise through", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100, "test")).resolves.toBe("ok");
  });
});

describe("withRetry", () => {
  it("retries until it succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("transient");
        return "ok";
      },
      { attempts: 3, baseDelayMs: 1 },
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("does not retry when the predicate says not to", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error("permanent");
        },
        { attempts: 3, baseDelayMs: 1, retryOn: () => false },
      ),
    ).rejects.toThrow("permanent");
    expect(attempts).toBe(1);
  });
});

describe("rate limiting", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit then throws", () => {
    for (let i = 0; i < 3; i++) {
      expect(() => checkRateLimit({ key: "k", limit: 3, windowMs: 1000 })).not.toThrow();
    }
    expect(() => checkRateLimit({ key: "k", limit: 3, windowMs: 1000 })).toThrowError(
      expect.objectContaining({ code: "RATE_LIMITED" }),
    );
  });

  it("scopes buckets by key", () => {
    checkRateLimit({ key: "a", limit: 1, windowMs: 1000 });
    expect(() => checkRateLimit({ key: "b", limit: 1, windowMs: 1000 })).not.toThrow();
  });
});

describe("twilio webhook signature verification", () => {
  const authToken = "test-auth-token";
  const url = "https://example.com/api/twilio/voice/incoming";
  const params = { CallSid: "CA123", From: "+15550100", To: "+15550199" };

  beforeEach(() => {
    process.env.TWILIO_AUTH_TOKEN = authToken;
  });

  it("accepts a correctly signed request", () => {
    const signature = twilio.getExpectedTwilioSignature(authToken, url, params);
    expect(() => verifyTwilioSignature({ signature, url, params })).not.toThrow();
  });

  it("rejects a missing signature", () => {
    expect(() => verifyTwilioSignature({ signature: null, url, params })).toThrowError(
      expect.objectContaining({ code: "WEBHOOK_SIGNATURE_INVALID" }),
    );
  });

  it("rejects a forged signature", () => {
    expect(() =>
      verifyTwilioSignature({ signature: "bogus", url, params }),
    ).toThrowError(expect.objectContaining({ code: "WEBHOOK_SIGNATURE_INVALID" }));
  });

  it("rejects a signature valid for different params (tamper detection)", () => {
    const signature = twilio.getExpectedTwilioSignature(authToken, url, params);
    const tampered = { ...params, To: "+15550999" };
    expect(() =>
      verifyTwilioSignature({ signature, url, params: tampered }),
    ).toThrowError(expect.objectContaining({ code: "WEBHOOK_SIGNATURE_INVALID" }));
  });

  it("rejects a signature valid for a different URL", () => {
    const signature = twilio.getExpectedTwilioSignature(authToken, url, params);
    expect(() =>
      verifyTwilioSignature({
        signature,
        url: "https://evil.example.com/api/twilio/voice/incoming",
        params,
      }),
    ).toThrowError(expect.objectContaining({ code: "WEBHOOK_SIGNATURE_INVALID" }));
  });
});
