import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signPrecheckToken, verifyPrecheckToken } from "./visitor-precheck-token";

describe("visitor-precheck-token", () => {
  const originalSecret = process.env.PRECHECK_TOKEN_SECRET;

  beforeEach(() => {
    process.env.PRECHECK_TOKEN_SECRET = "test-secret-for-vitest";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.PRECHECK_TOKEN_SECRET;
    } else {
      process.env.PRECHECK_TOKEN_SECRET = originalSecret;
    }
  });

  it("round-trips sign and verify", () => {
    const issuedAt = 1_700_000_000_000;
    const token = signPrecheckToken({
      email: "a@b.co",
      name: "Ada",
      source: "admin",
      protocolRequired: true,
      issuedAt,
    });
    const payload = verifyPrecheckToken(token);
    expect(payload).toEqual({
      email: "a@b.co",
      name: "Ada",
      source: "admin",
      protocolRequired: true,
      iat: issuedAt,
    });
  });

  it("returns null for tampered signature", () => {
    const token = signPrecheckToken({
      email: "a@b.co",
      name: "Ada",
      source: "kiosk_email",
      protocolRequired: false,
      issuedAt: 1_700_000_000_000,
    });
    const tampered = token.slice(0, -4) + "WXYZ";
    expect(verifyPrecheckToken(tampered)).toBe(null);
  });

  it("returns null for malformed token", () => {
    expect(verifyPrecheckToken("not-a-jwt-shape")).toBe(null);
    expect(verifyPrecheckToken("onlyonepart")).toBe(null);
  });

  it("normalizes iat from seconds to ms when small", () => {
    const issuedSeconds = 1_700_000_000;
    const token = signPrecheckToken({
      email: "t@t.co",
      name: "T",
      source: "admin",
      protocolRequired: false,
      issuedAt: issuedSeconds,
    });
    const payload = verifyPrecheckToken(token);
    expect(payload?.iat).toBe(issuedSeconds * 1000);
  });

  it("maps unknown source to kiosk_email", () => {
    const payloadB64 = Buffer.from(
      JSON.stringify({
        email: "x@y.z",
        name: "X",
        source: "kiosk",
        protocolRequired: false,
        iat: 1_800_000_000_000,
      }),
      "utf8"
    ).toString("base64url");
    const sig = crypto
      .createHmac("sha256", "test-secret-for-vitest")
      .update(payloadB64)
      .digest("base64url");
    const token = `${payloadB64}.${sig}`;
    expect(verifyPrecheckToken(token)?.source).toBe("kiosk_email");
  });

  it("uses email as name when name is blank", () => {
    const issuedAt = 1_700_000_000_000;
    const token = signPrecheckToken({
      email: "only@email.co",
      name: "   ",
      source: "admin",
      protocolRequired: false,
      issuedAt,
    });
    expect(verifyPrecheckToken(token)?.name).toBe("only@email.co");
  });
});
