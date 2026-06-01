import { describe, expect, it } from "vitest";
import {
  findVendorListMatchByTypedName,
  vendorInListSelectFromDropdownMessage,
} from "./vendor-company-list-match";

describe("findVendorListMatchByTypedName", () => {
  const vendors = [
    { id: "1", name: "Acme HVAC", isActive: true },
    { id: "2", name: "Beta Electric", isActive: true },
    { id: "3", name: "Old Co", isActive: false },
  ];

  it("matches case-insensitively with trim", () => {
    expect(findVendorListMatchByTypedName(vendors, "  acme hvac ")).toEqual(
      vendors[0]
    );
  });

  it("ignores inactive vendors", () => {
    expect(findVendorListMatchByTypedName(vendors, "Old Co")).toBeNull();
  });

  it("returns null when no match", () => {
    expect(findVendorListMatchByTypedName(vendors, "New Co")).toBeNull();
  });
});

describe("vendorInListSelectFromDropdownMessage", () => {
  it("includes the vendor display name", () => {
    expect(vendorInListSelectFromDropdownMessage("Acme HVAC")).toBe(
      "Vendor Acme HVAC is in the list, select from dropdown."
    );
  });
});
