import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_STALE_CHECKIN_HOURS,
  getStaleCheckinHoursForDisplay,
  getStaleCheckinMaxDurationMs,
} from "./stale-checkin-duration";

describe("stale-checkin-duration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to 16 hours when env is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_STALE_CHECKIN_CLEANUP_HOURS", "");
    expect(getStaleCheckinHoursForDisplay()).toBe(DEFAULT_STALE_CHECKIN_HOURS);
    expect(getStaleCheckinMaxDurationMs()).toBe(
      DEFAULT_STALE_CHECKIN_HOURS * 60 * 60 * 1000
    );
  });

  it("uses NEXT_PUBLIC_STALE_CHECKIN_CLEANUP_HOURS when valid", () => {
    vi.stubEnv("NEXT_PUBLIC_STALE_CHECKIN_CLEANUP_HOURS", "18");
    expect(getStaleCheckinHoursForDisplay()).toBe(18);
    expect(getStaleCheckinMaxDurationMs()).toBe(18 * 60 * 60 * 1000);
  });

  it("falls back when env is zero or invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_STALE_CHECKIN_CLEANUP_HOURS", "0");
    expect(getStaleCheckinHoursForDisplay()).toBe(DEFAULT_STALE_CHECKIN_HOURS);
    expect(getStaleCheckinMaxDurationMs()).toBe(
      DEFAULT_STALE_CHECKIN_HOURS * 60 * 60 * 1000
    );
  });
});
