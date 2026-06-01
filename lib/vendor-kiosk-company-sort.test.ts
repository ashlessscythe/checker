import { describe, expect, it } from "vitest";
import {
  recentlyAddedVendorIds,
  sortVendorsForKioskDropdown,
  uniqueRecentVendorListIds,
} from "./vendor-kiosk-company-sort";

const vendors = [
  { id: "a", name: "Zebra Plumbing", createdAt: 1000 },
  { id: "b", name: "Acme HVAC", createdAt: 5000 },
  { id: "c", name: "Beta Electric", createdAt: 3000 },
  { id: "d", name: "Delta Corp", createdAt: 2000 },
];

describe("uniqueRecentVendorListIds", () => {
  it("returns unique ids newest-first and skips empty vendorListId", () => {
    expect(
      uniqueRecentVendorListIds([
        { vendorListId: "b", createdAt: 100 },
        { vendorListId: "", createdAt: 200 },
        { vendorListId: "b", createdAt: 300 },
        { vendorListId: "a", createdAt: 250 },
      ])
    ).toEqual(["b", "a"]);
  });
});

describe("recentlyAddedVendorIds", () => {
  it("returns vendors created after cutoff", () => {
    const fresh = [
      { id: "b", name: "Acme HVAC", createdAt: 9000 },
      { id: "c", name: "Beta Electric", createdAt: 8000 },
      { id: "a", name: "Zebra Plumbing", createdAt: 1000 },
    ];
    const ids = recentlyAddedVendorIds(fresh, 3000, 10_000);
    expect(ids).toEqual(["b", "c"]);
  });
});

describe("sortVendorsForKioskDropdown", () => {
  it("sorts alphabetically when there is no recent usage or additions", () => {
    const sorted = sortVendorsForKioskDropdown(vendors, [], []);
    expect(sorted.map((v) => v.id)).toEqual(["b", "c", "d", "a"]);
  });

  it("pins recently used vendors first then sorts the rest A–Z", () => {
    const sorted = sortVendorsForKioskDropdown(vendors, ["d", "a"], []);
    expect(sorted.map((v) => v.id)).toEqual(["d", "a", "b", "c"]);
  });

  it("pins recently added after recent used, then A–Z for the rest", () => {
    const now = 6000;
    const added = recentlyAddedVendorIds(vendors, 2500, now);
    const sorted = sortVendorsForKioskDropdown(vendors, ["d"], added);
    expect(sorted.map((v) => v.id)[0]).toBe("d");
    expect(sorted.map((v) => v.id).slice(1, 3)).toEqual(["b", "c"]);
    expect(sorted.map((v) => v.id).slice(3)).toEqual(["a"]);
  });

  it("uses recently added at top when there is no recent usage", () => {
    const now = 6000;
    const added = recentlyAddedVendorIds(vendors, 2500, now);
    const sorted = sortVendorsForKioskDropdown(vendors, [], added);
    expect(sorted.map((v) => v.id).slice(0, 2)).toEqual(["b", "c"]);
    expect(sorted.map((v) => v.id).slice(2)).toEqual(["d", "a"]);
  });
});
