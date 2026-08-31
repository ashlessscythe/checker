import { tx } from "@instantdb/admin";
import { formatAdminApiError } from "@/lib/admin-api-error";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { jsonError, methodNotAllowed } from "@/lib/public-api-http";
import { requireSignedInAdmin } from "@/lib/require-signed-in-admin";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSignedInAdmin(req);
    if (admin.ok === false) return admin.response;

    const { id } = await context.params;
    if (!id) {
      return jsonError("Missing key id.", 400);
    }

    const adminAPI = requireAdminAPI();
    const data = (await adminAPI.query({
      apiKeys: {
        $: { where: { id }, limit: 1 },
      },
    })) as { apiKeys?: Array<{ id: string; revokedAt?: number }> };

    const row = data.apiKeys?.[0];
    if (!row) {
      return jsonError("API key not found.", 404);
    }

    if (typeof row.revokedAt === "number" && row.revokedAt > 0) {
      return Response.json({ ok: true, id: row.id, alreadyRevoked: true });
    }

    const revokedAt = Date.now();
    await adminAPI.transact([
      tx.apiKeys[row.id].update({ revokedAt }),
    ]);

    return Response.json({ ok: true, id: row.id, revokedAt });
  } catch (e: unknown) {
    return jsonError(formatAdminApiError(e), 500);
  }
}

export async function GET() {
  return methodNotAllowed("DELETE");
}

export async function POST() {
  return methodNotAllowed("DELETE");
}
