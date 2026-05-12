import { describe, expect, it } from "vitest";
import {
  getLatestPunch,
  isUserCheckedInFromPunches,
  normName,
  syntheticVendorBarcode,
  syntheticVendorEmail,
} from "./vendor-kiosk-server";

describe("normName", () => {
  it("trims and lowercases", () => {
    expect(normName("  Acme Corp  ")).toBe("acme corp");
  });
});

describe("syntheticVendorEmail / syntheticVendorBarcode", () => {
  it("builds stable internal identifiers from user id", () => {
    expect(syntheticVendorEmail("abc-123")).toBe(
      "vendor+abc-123@checker-vendor.internal"
    );
    expect(syntheticVendorBarcode("xyz")).toBe("VENDOR-xyz");
  });
});

describe("getLatestPunch", () => {
  it("returns null for empty or missing punches", () => {
    expect(getLatestPunch(undefined)).toBe(null);
    expect(getLatestPunch([])).toBe(null);
  });

  it("prefers higher serverCreatedAt, then timestamp", () => {
    const punches = [
      { type: "checkin", timestamp: 100, serverCreatedAt: 10 },
      { type: "checkout", timestamp: 50, serverCreatedAt: 20 },
      { type: "checkin", timestamp: 200, serverCreatedAt: 20 },
    ];
    const latest = getLatestPunch(punches);
    expect(latest?.timestamp).toBe(200);
  });

  it("falls back to timestamp when serverCreatedAt ties at 0", () => {
    const punches = [
      { type: "checkin", timestamp: 10, serverCreatedAt: 0 },
      { type: "checkout", timestamp: 99, serverCreatedAt: 0 },
    ];
    expect(getLatestPunch(punches)?.type).toBe("checkout");
  });
});

describe("isUserCheckedInFromPunches", () => {
  it("is false when there is no punch", () => {
    expect(isUserCheckedInFromPunches(undefined)).toBe(false);
    expect(isUserCheckedInFromPunches([])).toBe(false);
  });

  it("is true when latest punch is a check-in type", () => {
    expect(
      isUserCheckedInFromPunches([
        { type: "checkout", timestamp: 1, serverCreatedAt: 1 },
        { type: "checkin", timestamp: 2, serverCreatedAt: 2 },
      ])
    ).toBe(true);
  });

  it("is false when latest punch is checkout", () => {
    expect(
      isUserCheckedInFromPunches([
        { type: "checkin", timestamp: 1, serverCreatedAt: 1 },
        { type: "checkout", timestamp: 2, serverCreatedAt: 2 },
      ])
    ).toBe(false);
  });

  it("treats admin and system check-in as checked in", () => {
    expect(
      isUserCheckedInFromPunches([
        { type: "admin_checkin", timestamp: 1, serverCreatedAt: 1 },
      ])
    ).toBe(true);
    expect(
      isUserCheckedInFromPunches([
        { type: "sys_checkin", timestamp: 1, serverCreatedAt: 1 },
      ])
    ).toBe(true);
  });
});
