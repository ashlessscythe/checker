import { formatAdminApiError } from "@/lib/admin-api-error";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import {
  authenticatePublicApiRequest,
  listPublicUsers,
  touchApiKeyLastUsed,
} from "@/lib/public-api-data";
import { jsonError, methodNotAllowed } from "@/lib/public-api-http";
import { parseUserQuery } from "@/lib/public-api-query";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const adminAPI = requireAdminAPI();
    const auth = await authenticatePublicApiRequest(req, adminAPI);
    if (auth.ok === false) {
      const headers =
        auth.status === 429 ? { "Retry-After": "60" } : undefined;
      return jsonError(auth.error, auth.status, headers);
    }
    if (auth.shouldTouchLastUsed) {
      await touchApiKeyLastUsed(adminAPI, auth.key.id);
    }

    const parsed = parseUserQuery(new URL(req.url).searchParams);
    if ("error" in parsed) {
      return jsonError(parsed.error, 400);
    }

    const result = await listPublicUsers(adminAPI, parsed);
    return Response.json(result);
  } catch (e: unknown) {
    return jsonError(formatAdminApiError(e), 500);
  }
}

export async function POST() {
  return methodNotAllowed();
}

export async function PUT() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}
