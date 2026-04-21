import { verifyPrecheckToken } from "@/lib/visitor-precheck-token";
import { requireAdminAPI } from "@/lib/instantdb-admin";

export type PrecheckLinkPayload = NonNullable<ReturnType<typeof verifyPrecheckToken>>;

/**
 * Cryptographic validity + 24h window + revoked list (same rules as /api/visitor/precheck/validate).
 */
export async function assertPrecheckLinkActive(
  token: string
): Promise<
  { ok: true; payload: PrecheckLinkPayload } | { ok: false; status: number; error: string }
> {
  const payload = verifyPrecheckToken(token);
  if (!payload?.email) {
    return { ok: false, status: 400, error: "Invalid token." };
  }

  const now = Date.now();
  const issuedAt = payload.iat;
  const expiresAt = issuedAt + 24 * 60 * 60 * 1000;
  if (now > expiresAt) {
    return { ok: false, status: 400, error: "Token expired or already used." };
  }

  try {
    const adminAPI = requireAdminAPI();
    const revokedData = await adminAPI.query({
      revokedPrecheckTokens: {
        $: {
          where: { token },
        },
      },
    });
    const revoked = (revokedData as { revokedPrecheckTokens?: unknown[] })
      ?.revokedPrecheckTokens;
    if (revoked && revoked.length > 0) {
      return {
        ok: false,
        status: 400,
        error:
          "This pre-check link is no longer valid. Ask your host for a new invitation if you still need access.",
      };
    }
  } catch (revokeCheckErr) {
    console.error("assertPrecheckLinkActive: revoked token lookup failed", revokeCheckErr);
  }

  return { ok: true, payload };
}
