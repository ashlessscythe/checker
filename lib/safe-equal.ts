import crypto from "crypto";

/** Constant-time string comparison (length mismatch returns false). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(new Uint8Array(left), new Uint8Array(right));
}
