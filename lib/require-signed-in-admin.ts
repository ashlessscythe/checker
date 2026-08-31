import { NextResponse } from "next/server";
import { formatAdminApiError } from "@/lib/admin-api-error";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { API_KEY_PREFIX } from "@/lib/public-api-keys";
import { parseAuthorizationBearer } from "@/lib/public-api-auth";

type InstantUser = { id?: string; email?: string } | null;

function isTruthyAdmin(value: unknown): boolean {
  return value !== false && value !== "false" && Boolean(value);
}

async function findAppUserByEmail(
  adminAPI: ReturnType<typeof requireAdminAPI>,
  email: string
): Promise<{ id: string; email?: string; isAdmin?: boolean } | null> {
  const candidates = Array.from(new Set([email, email.toLowerCase()]));
  for (const candidate of candidates) {
    const data = (await adminAPI.query({
      users: {
        $: { where: { email: candidate }, limit: 5 },
      },
    })) as {
      users?: Array<{ id: string; email?: string; isAdmin?: boolean }>;
    };
    const match = (data.users ?? []).find(
      (u) => String(u.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (match) return match;
  }
  return null;
}

export async function requireSignedInAdmin(req: Request): Promise<
  | { ok: true; email: string }
  | { ok: false; response: NextResponse }
> {
  const token = parseAuthorizationBearer(req.headers.get("authorization"));
  if (!token || token.startsWith(API_KEY_PREFIX)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  let adminAPI: ReturnType<typeof requireAdminAPI>;
  try {
    adminAPI = requireAdminAPI();
  } catch (e) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: formatAdminApiError(e) },
        { status: 500 }
      ),
    };
  }

  let instantUser: InstantUser = null;
  try {
    instantUser = (await adminAPI.auth.verifyToken(token)) as InstantUser;
  } catch {
    instantUser = null;
  }

  const email = instantUser?.email?.trim();
  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const appUser = await findAppUserByEmail(adminAPI, email);
  if (!appUser || !isTruthyAdmin(appUser.isAdmin)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, email };
}
