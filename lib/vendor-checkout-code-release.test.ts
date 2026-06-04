import { describe, expect, it } from "vitest";
import {
  isActiveVendorCheckoutCode,
  releasedVendorCheckoutCode,
} from "./vendor-checkout-code-release";

describe("isActiveVendorCheckoutCode", () => {
  it("accepts 3-digit codes only", () => {
    expect(isActiveVendorCheckoutCode("100")).toBe(true);
    expect(isActiveVendorCheckoutCode("999")).toBe(true);
    expect(isActiveVendorCheckoutCode("1000")).toBe(false);
    expect(isActiveVendorCheckoutCode("released:abc")).toBe(false);
    expect(isActiveVendorCheckoutCode("")).toBe(false);
  });
});

describe("releasedVendorCheckoutCode", () => {
  it("returns a unique non-digit placeholder per row", () => {
    expect(releasedVendorCheckoutCode("row-1")).toBe("released:row-1");
    expect(isActiveVendorCheckoutCode(releasedVendorCheckoutCode("row-1"))).toBe(
      false
    );
  });
});
