import crypto from "crypto";

export const API_KEY_PREFIX = "chk_";
const SECRET_BYTES = 32;
/** `chk_` + 8 hex chars, enough to identify a key in the admin list. */
export const API_KEY_DISPLAY_PREFIX_LENGTH = 12;

const API_KEY_BODY_RE = /^[a-f0-9]{64}$/i;

export function hashApiKey(secret: string): string {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

export function apiKeyDisplayPrefix(secret: string): string {
  return secret.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH);
}

export function isApiKeyFormat(secret: string): boolean {
  if (!secret.startsWith(API_KEY_PREFIX)) return false;
  return API_KEY_BODY_RE.test(secret.slice(API_KEY_PREFIX.length));
}

export function hashesEqual(a: string, b: string): boolean {
  const left = new Uint8Array(Buffer.from(a, "utf8"));
  const right = new Uint8Array(Buffer.from(b, "utf8"));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function generateApiKey(): {
  secret: string;
  keyHash: string;
  keyPrefix: string;
} {
  const secret = `${API_KEY_PREFIX}${crypto.randomBytes(SECRET_BYTES).toString("hex")}`;
  return {
    secret,
    keyHash: hashApiKey(secret),
    keyPrefix: apiKeyDisplayPrefix(secret),
  };
}
