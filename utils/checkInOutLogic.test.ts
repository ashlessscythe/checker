import { describe, expect, it } from "vitest";
import {
  CheckActionType,
  determineAutoPunchAction,
  extractUserId,
  getMostReliablePunch,
} from "./checkInOutLogic";

describe("determineAutoPunchAction", () => {
  const resetHours = 14;
  const base = 1_700_000_000_000;

  it("check-in when there is no prior punch", () => {
    expect(determineAutoPunchAction(null, base, resetHours)).toBe(
      CheckActionType.CheckIn
    );
  });

  it("after reset window, always check-in even if last was check-in", () => {
    const last = {
      type: "checkin",
      timestamp: base - resetHours * 60 * 60 * 1000 - 1,
      serverCreatedAt: 1,
    };
    expect(determineAutoPunchAction(last, base, resetHours)).toBe(
      CheckActionType.CheckIn
    );
  });

  it("exactly at reset boundary, treats as stale and check-in", () => {
    const last = {
      type: "checkin",
      timestamp: base - resetHours * 60 * 60 * 1000,
      serverCreatedAt: 1,
    };
    expect(determineAutoPunchAction(last, base, resetHours)).toBe(
      CheckActionType.CheckIn
    );
  });

  it("before reset window, toggles from check-in to check-out", () => {
    const last = {
      type: "checkin",
      timestamp: base - 60 * 60 * 1000,
      serverCreatedAt: 1,
    };
    expect(determineAutoPunchAction(last, base, resetHours)).toBe(
      CheckActionType.CheckOut
    );
  });

  it("before reset window, toggles from check-out to check-in", () => {
    const last = {
      type: "checkout",
      timestamp: base - 60 * 60 * 1000,
      serverCreatedAt: 1,
    };
    expect(determineAutoPunchAction(last, base, resetHours)).toBe(
      CheckActionType.CheckIn
    );
  });

  it("treats admin_checkout like checkout within window", () => {
    const last = {
      type: "admin_checkout",
      timestamp: base - 60 * 60 * 1000,
      serverCreatedAt: 1,
    };
    expect(determineAutoPunchAction(last, base, resetHours)).toBe(
      CheckActionType.CheckIn
    );
  });
});

describe("getMostReliablePunch", () => {
  it("picks higher serverCreatedAt when both set", () => {
    const punches = [
      { type: "checkin", timestamp: 200, serverCreatedAt: 10 },
      { type: "checkout", timestamp: 50, serverCreatedAt: 20 },
    ];
    expect(getMostReliablePunch(punches)?.type).toBe("checkout");
  });

  it("falls back to client timestamp when serverCreatedAt missing", () => {
    const punches = [
      { type: "checkin", timestamp: 10 },
      { type: "checkout", timestamp: 99 },
    ];
    expect(getMostReliablePunch(punches)?.type).toBe("checkout");
  });
});

describe("extractUserId", () => {
  it("returns alphanumeric scan unchanged", () => {
    expect(extractUserId("VENDOR-abc")).toBe("VENDOR-abc");
  });

  it("extracts earliest matching numeric pattern", () => {
    expect(extractUserId("99100123456")).toBe("100123456");
  });
});
