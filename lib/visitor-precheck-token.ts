import crypto from "crypto";
import { getPrecheckSecret } from "@/lib/precheck-secret";
import { safeEqual } from "@/lib/safe-equal";

export type PrecheckTokenSource = "admin" | "kiosk_email" | "kiosk_register";

const getSecret = () => getPrecheckSecret();

export function signPrecheckToken({
  email,
  name,
  source,
  protocolRequired,
  issuedAt,
}: {
  email: string;
  name: string;
  source: PrecheckTokenSource;
  protocolRequired: boolean;
  issuedAt: number;
}): string {
  const payload = JSON.stringify({
    email,
    name,
    source,
    protocolRequired,
    iat: issuedAt,
  });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyPrecheckToken(token: string): null | {
  email: string;
  name: string;
  source: PrecheckTokenSource;
  protocolRequired: boolean;
  iat: number;
} {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64url");
  if (!safeEqual(expectedSig, sig)) return null;

  let parsed: {
    email?: string;
    name?: string;
    source?: string;
    protocolRequired?: boolean;
    iat?: number;
  };
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!parsed.email || typeof parsed.iat !== "number") return null;

  let issuedAt = parsed.iat;
  if (issuedAt < 1e12) {
    issuedAt = issuedAt * 1000;
  }

  const rawSource = parsed.source;
  let source: PrecheckTokenSource;
  if (rawSource === "admin") {
    source = "admin";
  } else if (rawSource === "kiosk_register") {
    source = "kiosk_register";
  } else {
    // "kiosk", "kiosk_email", missing → kiosk link email flow
    source = "kiosk_email";
  }

  const name =
    parsed.name && String(parsed.name).trim().length > 0
      ? String(parsed.name).trim()
      : parsed.email;

  return {
    email: parsed.email,
    name,
    source,
    protocolRequired: Boolean(parsed.protocolRequired),
    iat: issuedAt,
  };
}
