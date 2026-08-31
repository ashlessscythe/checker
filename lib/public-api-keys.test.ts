import { describe, expect, it } from "vitest";
import {
  apiKeyDisplayPrefix,
  generateApiKey,
  hashApiKey,
  hashesEqual,
  isApiKeyFormat,
} from "./public-api-keys";

describe("public-api-keys", () => {
  it("generates chk_ secrets with a stable hash and prefix", () => {
    const key = generateApiKey();
    expect(isApiKeyFormat(key.secret)).toBe(true);
    expect(key.keyHash).toBe(hashApiKey(key.secret));
    expect(key.keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(key.keyPrefix).toBe(apiKeyDisplayPrefix(key.secret));
    expect(key.keyPrefix).toHaveLength(12);
    expect(key.keyPrefix.startsWith("chk_")).toBe(true);
  });

  it("does not store-equivalent hashes for different secrets", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.secret).not.toBe(b.secret);
    expect(a.keyHash).not.toBe(b.keyHash);
  });

  it("rejects malformed secrets", () => {
    expect(isApiKeyFormat("")).toBe(false);
    expect(isApiKeyFormat("chk_short")).toBe(false);
    expect(isApiKeyFormat("sk_" + "a".repeat(64))).toBe(false);
  });

  it("compares hashes in equal-length buffers", () => {
    const hash = hashApiKey("chk_" + "ab".repeat(32));
    const other = hashApiKey("chk_" + "cd".repeat(32));
    expect(hashesEqual(hash, hash)).toBe(true);
    expect(hashesEqual(hash, other)).toBe(false);
  });
});
