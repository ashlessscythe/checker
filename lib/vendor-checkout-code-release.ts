import { VENDOR_CHECKOUT_CODE_LENGTH } from "@/lib/vendor-checkout-code";

/** True when the code is a live kiosk checkout number (digits only, configured length). */
export function isActiveVendorCheckoutCode(code: string): boolean {
  if (!code) return false;
  const re = new RegExp(`^\\d{${VENDOR_CHECKOUT_CODE_LENGTH}}$`);
  return re.test(code);
}

/** Stored on checked-out rows after release so the unique index can reuse the 3-digit code. */
export function releasedVendorCheckoutCode(rowId: string): string {
  return `released:${rowId}`;
}
