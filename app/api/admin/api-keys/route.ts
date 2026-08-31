import { id, tx } from "@instantdb/admin";
import { formatAdminApiError } from "@/lib/admin-api-error";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { jsonError, methodNotAllowed } from "@/lib/public-api-http";
import { generateApiKey } from "@/lib/public-api-keys";
import { requireSignedInAdmin } from "@/lib/require-signed-in-admin";

export const runtime = "nodejs";

const MAX_KEY_NAME_LENGTH = 80;

type ApiKeyRow = {
  id: string;
  name?: string;
  keyPrefix?: string;
  createdAt?: number;
  createdByEmail?: string;
  lastUsedAt?: number;
  revokedAt?: number;
};

function toPublicKey(row: ApiKeyRow) {
  return {
    id: row.id,
    name: row.name ?? "",
    keyPrefix: row.keyPrefix ?? "",
    createdAt: row.createdAt ?? 0,
    createdByEmail: row.createdByEmail ?? "",
    lastUsedAt: row.lastUsedAt && row.lastUsedAt > 0 ? row.lastUsedAt : null,
    revokedAt: row.revokedAt && row.revokedAt > 0 ? row.revokedAt : null,
  };
}

export async function GET(req: Request) {
  try {
    const admin = await requireSignedInAdmin(req);
    if (admin.ok === false) return admin.response;

    const adminAPI = requireAdminAPI();
    const data = (await adminAPI.query({
      apiKeys: {
        $: { order: { createdAt: "desc" } },
      },
    })) as { apiKeys?: ApiKeyRow[] };

    return Response.json({
      data: (data.apiKeys ?? []).map(toPublicKey),
    });
  } catch (e: unknown) {
    return jsonError(formatAdminApiError(e), 500);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireSignedInAdmin(req);
    if (admin.ok === false) return admin.response;

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return jsonError("Name is required.", 400);
    }
    if (name.length > MAX_KEY_NAME_LENGTH) {
      return jsonError(`Name must be ${MAX_KEY_NAME_LENGTH} characters or fewer.`, 400);
    }

    const generated = generateApiKey();
    const keyId = id();
    const createdAt = Date.now();
    const adminAPI = requireAdminAPI();
    await adminAPI.transact([
      tx.apiKeys[keyId].update({
        name,
        keyHash: generated.keyHash,
        keyPrefix: generated.keyPrefix,
        createdAt,
        createdByEmail: admin.email,
        lastUsedAt: 0,
        revokedAt: 0,
      }),
    ]);

    return Response.json({
      id: keyId,
      name,
      keyPrefix: generated.keyPrefix,
      createdAt,
      createdByEmail: admin.email,
      lastUsedAt: null,
      revokedAt: null,
      secret: generated.secret,
    });
  } catch (e: unknown) {
    return jsonError(formatAdminApiError(e), 500);
  }
}

export async function PUT() {
  return methodNotAllowed("GET, POST");
}

export async function PATCH() {
  return methodNotAllowed("GET, POST");
}

export async function DELETE() {
  return methodNotAllowed("GET, POST");
}
