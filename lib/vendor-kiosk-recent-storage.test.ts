import { describe, expect, it } from "vitest";
import { mergeRecentVendorIds } from "./vendor-kiosk-recent-storage";

describe("mergeRecentVendorIds", () => {
  it("prefers local ids then server, deduped", () => {
    expect(mergeRecentVendorIds(["b", "a"], ["a", "c"])).toEqual(["b", "a", "c"]);
  });

  it("respects limit", () => {
    expect(
      mergeRecentVendorIds(["1", "2", "3"], ["4", "5"], 3)
    ).toEqual(["1", "2", "3"]);
  });
});
