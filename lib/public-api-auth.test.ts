import { describe, expect, it } from "vitest";
import { generateApiKey } from "./public-api-keys";
import {
  authenticatePresentedKey,
  parseAuthorizationBearer,
} from "./public-api-auth";
import { createRateLimiter } from "./public-api-rate-limit";

describe("parseAuthorizationBearer", () => {
  it("extracts the token", () => {
    expect(parseAuthorizationBearer("Bearer abc")).toBe("abc");
    expect(parseAuthorizationBearer("bearer abc")).toBe("abc");
    expect(parseAuthorizationBearer("Basic abc")).toBe(null);
    expect(parseAuthorizationBearer(null)).toBe(null);
  });
});

describe("authenticatePresentedKey", () => {
  it("returns 401 for missing or malformed keys", async () => {
    const missing = await authenticatePresentedKey({
      authorizationHeader: null,
      lookupByHash: async () => null,
      tryConsumeRateLimit: () => true,
    });
    expect(missing).toEqual({
      ok: false,
      status: 401,
      error: "Invalid API key",
    });

    const bad = await authenticatePresentedKey({
      authorizationHeader: "Bearer not-a-key",
      lookupByHash: async () => null,
      tryConsumeRateLimit: () => true,
    });
    expect(bad.ok).toBe(false);
    if (bad.ok === false) expect(bad.status).toBe(401);
  });

  it("returns 401 for unknown and revoked keys", async () => {
    const generated = generateApiKey();
    const unknown = await authenticatePresentedKey({
      authorizationHeader: `Bearer ${generated.secret}`,
      lookupByHash: async () => null,
      tryConsumeRateLimit: () => true,
    });
    expect(unknown.ok).toBe(false);
    if (unknown.ok === false) expect(unknown.status).toBe(401);

    const revoked = await authenticatePresentedKey({
      authorizationHeader: `Bearer ${generated.secret}`,
      lookupByHash: async () => ({
        id: "k1",
        keyHash: generated.keyHash,
        revokedAt: 1,
      }),
      tryConsumeRateLimit: () => true,
    });
    expect(revoked).toEqual({
      ok: false,
      status: 401,
      error: "Invalid API key",
    });
  });

  it("returns 429 when the limiter is exhausted", async () => {
    const generated = generateApiKey();
    const result = await authenticatePresentedKey({
      authorizationHeader: `Bearer ${generated.secret}`,
      lookupByHash: async () => ({
        id: "k1",
        keyHash: generated.keyHash,
        lastUsedAt: 0,
      }),
      tryConsumeRateLimit: () => false,
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.status).toBe(429);
  });

  it("accepts a valid key", async () => {
    const generated = generateApiKey();
    const now = 1_000_000;
    const result = await authenticatePresentedKey({
      authorizationHeader: `Bearer ${generated.secret}`,
      now,
      lookupByHash: async () => ({
        id: "k1",
        keyHash: generated.keyHash,
        lastUsedAt: 0,
      }),
      tryConsumeRateLimit: () => true,
    });
    expect(result).toEqual({
      ok: true,
      key: { id: "k1", keyHash: generated.keyHash, lastUsedAt: 0 },
      shouldTouchLastUsed: true,
    });
  });
});

describe("createRateLimiter", () => {
  it("allows up to max hits then rejects", () => {
    const limiter = createRateLimiter(2, 60_000);
    expect(limiter.tryConsume("k", 1000)).toBe(true);
    expect(limiter.tryConsume("k", 2000)).toBe(true);
    expect(limiter.tryConsume("k", 3000)).toBe(false);
    expect(limiter.tryConsume("k", 1000 + 60_000)).toBe(true);
  });
});
