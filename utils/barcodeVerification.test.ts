import { describe, expect, it, vi, afterEach } from "vitest";
import { generateValidBarcode, verifyBarcode } from "./barcodeVerification";

const VALID_CHARSET = /^[346789ACDEFGHJKLMNPQRTUVWXY]{20}$/;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verifyBarcode", () => {
  it("rejects wrong length", () => {
    expect(verifyBarcode("")).toBe(false);
    expect(verifyBarcode("3".repeat(19))).toBe(false);
    expect(verifyBarcode("3".repeat(21))).toBe(false);
  });

  it("rejects disallowed characters", () => {
    const twenty = "3".repeat(19) + "0";
    expect(verifyBarcode(twenty)).toBe(false);
    expect(verifyBarcode("O".repeat(20))).toBe(false);
  });

  it("rejects a tampered valid-shaped code", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const good = generateValidBarcode();
    const last = good[19];
    const idx = "346789ACDEFGHJKLMNPQRTUVWXY".indexOf(last);
    const replacement =
      "346789ACDEFGHJKLMNPQRTUVWXY"[(idx + 3) % 25] || "3";
    const tampered = good.slice(0, 19) + replacement;
    expect(tampered).not.toBe(good);
    expect(verifyBarcode(tampered)).toBe(false);
  });
});

describe("generateValidBarcode", () => {
  it("returns a 20-char code in the allowed set that verifies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const code = generateValidBarcode();
    expect(code).toHaveLength(20);
    expect(code).toMatch(VALID_CHARSET);
    expect(verifyBarcode(code)).toBe(true);
  });

  it("is deterministic when Math.random is fixed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const a = generateValidBarcode();
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const b = generateValidBarcode();
    expect(a).toBe(b);
  });
});
