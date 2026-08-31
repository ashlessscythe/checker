import { hashApiKey, hashesEqual, isApiKeyFormat } from "@/lib/public-api-keys";
import { shouldTouchLastUsed } from "@/lib/public-api-query";

export type StoredApiKey = {
  id: string;
  keyHash: string;
  keyPrefix?: string;
  name?: string;
  revokedAt?: number;
  lastUsedAt?: number;
};

export type ApiAuthFailure = {
  ok: false;
  status: 401 | 429;
  error: string;
};

export type ApiAuthSuccess = {
  ok: true;
  key: StoredApiKey;
  shouldTouchLastUsed: boolean;
};

export type ApiAuthResult = ApiAuthFailure | ApiAuthSuccess;

const INVALID_KEY = "Invalid API key";

export function parseAuthorizationBearer(
  authorizationHeader: string | null | undefined
): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(\S+)/i.exec(authorizationHeader.trim());
  return match?.[1] ?? null;
}

export function isRevokedApiKey(key: StoredApiKey): boolean {
  return typeof key.revokedAt === "number" && key.revokedAt > 0;
}

export async function authenticatePresentedKey(args: {
  authorizationHeader: string | null | undefined;
  now?: number;
  lookupByHash: (hash: string) => Promise<StoredApiKey | null>;
  tryConsumeRateLimit: (keyId: string, now: number) => boolean;
}): Promise<ApiAuthResult> {
  const now = args.now ?? Date.now();
  const secret = parseAuthorizationBearer(args.authorizationHeader);
  if (!secret || !isApiKeyFormat(secret)) {
    return { ok: false, status: 401, error: INVALID_KEY };
  }

  const presentedHash = hashApiKey(secret);
  const record = await args.lookupByHash(presentedHash);
  if (!record || !hashesEqual(record.keyHash, presentedHash) || isRevokedApiKey(record)) {
    return { ok: false, status: 401, error: INVALID_KEY };
  }

  if (!args.tryConsumeRateLimit(record.id, now)) {
    return {
      ok: false,
      status: 429,
      error: "Rate limit exceeded. Try again in a minute.",
    };
  }

  return {
    ok: true,
    key: record,
    shouldTouchLastUsed: shouldTouchLastUsed(record.lastUsedAt, now),
  };
}
