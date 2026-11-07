import crypto from "crypto";
import { getPrecheckSecret } from "@/lib/precheck-secret";
import { safeEqual } from "@/lib/safe-equal";

const getSecret = () =>
  getPrecheckSecret({ preferred: process.env.VISITOR_HOST_REVIEW_SECRET });

export function signHostPrecheckReviewToken(requestId: string): string {
  const payload = JSON.stringify({ rid: requestId, v: 1 });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyHostPrecheckReviewToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64url");
  if (!safeEqual(expectedSig, sig)) return null;

  let parsed: { rid?: string; v?: number };
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed.rid || typeof parsed.rid !== "string") return null;
  return parsed.rid;
}
