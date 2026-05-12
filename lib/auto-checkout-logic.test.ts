import { describe, expect, it } from "vitest";
import { userQualifiesForStaleAutoCheckout } from "./auto-checkout-logic";

describe("userQualifiesForStaleAutoCheckout", () => {
  const maxMs = 16 * 60 * 60 * 1000;
  const now = 1_800_000_000_000;

  it("false when no punches", () => {
    expect(userQualifiesForStaleAutoCheckout(undefined, now, maxMs)).toBe(
      false
    );
    expect(userQualifiesForStaleAutoCheckout([], now, maxMs)).toBe(false);
  });

  it("false when last punch is not a check-in type", () => {
    expect(
      userQualifiesForStaleAutoCheckout(
        [
          {
            type: "checkout",
            timestamp: now - maxMs - 1,
            serverCreatedAt: 1,
          },
        ],
        now,
        maxMs
      )
    ).toBe(false);
  });

  it("false when checked in but under max duration", () => {
    expect(
      userQualifiesForStaleAutoCheckout(
        [
          {
            type: "checkin",
            timestamp: now - maxMs + 60_000,
            serverCreatedAt: 1,
          },
        ],
        now,
        maxMs
      )
    ).toBe(false);
  });

  it("true when checked in and strictly over max duration", () => {
    expect(
      userQualifiesForStaleAutoCheckout(
        [
          {
            type: "checkin",
            timestamp: now - maxMs - 1,
            serverCreatedAt: 1,
          },
        ],
        now,
        maxMs
      )
    ).toBe(true);
  });

  it("includes admin_checkin as checked-in", () => {
    expect(
      userQualifiesForStaleAutoCheckout(
        [
          {
            type: "admin_checkin",
            timestamp: now - maxMs - 1,
            serverCreatedAt: 1,
          },
        ],
        now,
        maxMs
      )
    ).toBe(true);
  });
});
