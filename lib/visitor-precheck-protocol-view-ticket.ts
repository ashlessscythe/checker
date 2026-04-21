import crypto from "crypto";

function ticketSecret() {
  return process.env.PRECHECK_TOKEN_SECRET || "dev-precheck-secret";
}

const PURPOSE = "protocol_document_view";

/** Short-lived capability for kiosk users (no invite token). */
export function signProtocolViewTicket(ttlSeconds = 900): string {
  const expMs = Date.now() + ttlSeconds * 1000;
  const payload = JSON.stringify({ p: PURPOSE, expMs });
  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", ticketSecret())
    .update(b64)
    .digest("base64url");
  return `${b64}.${sig}`;
}

export function verifyProtocolViewTicket(ticket: string): boolean {
  const parts = ticket.split(".");
  if (parts.length !== 2) return false;
  const [b64, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", ticketSecret())
    .update(b64)
    .digest("base64url");
  if (expectedSig !== sig) return false;
  try {
    const parsed = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as {
      p?: string;
      expMs?: number;
    };
    if (parsed.p !== PURPOSE || typeof parsed.expMs !== "number") return false;
    if (Date.now() > parsed.expMs) return false;
    return true;
  } catch {
    return false;
  }
}
