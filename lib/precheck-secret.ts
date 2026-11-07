const DEV_FALLBACK_SECRET = "dev-precheck-secret";

/**
 * HMAC secret for pre-check tokens, host-review tokens and protocol view tickets.
 * In production a missing secret is a hard error: the dev fallback is public in
 * the repo, so using it would let anyone forge tokens.
 */
export function getPrecheckSecret(opts?: { preferred?: string }): string {
  const secret = opts?.preferred || process.env.PRECHECK_TOKEN_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PRECHECK_TOKEN_SECRET is not set in environment variables");
  }
  return DEV_FALLBACK_SECRET;
}
