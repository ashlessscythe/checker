/** Unique checkout code length shown to vendors at check-in (digits only, no leading zeros). */
export const VENDOR_CHECKOUT_CODE_LENGTH = 3;

/** Random numeric checkout code, e.g. "100".."999" when length is 3. */
export function randomVendorCheckoutCode(): string {
  const max = 10 ** VENDOR_CHECKOUT_CODE_LENGTH;
  const min = max / 10;
  const n = min + Math.floor(Math.random() * (max - min));
  return String(n);
}
