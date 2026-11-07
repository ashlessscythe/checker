import { NextResponse } from "next/server";
import { tx } from "@instantdb/admin";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { parseAuthorizationBearer } from "@/lib/public-api-auth";
import { findAppUserByEmail } from "@/lib/require-signed-in-admin";

export const runtime = "nodejs";

/**
 * Links the signed-in Instant auth user to their app `users` row so Instant
 * permission rules can read `isAdmin` / `isAuth` through `auth.ref`.
 * Identity comes from the verified refresh token, never from the request body.
 */
export async function POST(req: Request) {
  const token = parseAuthorizationBearer(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const adminAPI = requireAdminAPI();
    const authUser = (await adminAPI.auth.verifyToken(token)) as {
      id?: string;
      email?: string;
    } | null;
    const email = authUser?.email?.trim();
    if (!authUser?.id || !email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const appUser = await findAppUserByEmail(adminAPI, email);
    if (!appUser) {
      return NextResponse.json({ ok: true, linked: false });
    }
    await adminAPI.transact(
      tx.users[appUser.id].link({ $user: authUser.id })
    );
    return NextResponse.json({ ok: true, linked: true });
  } catch {
    return NextResponse.json({ error: "Failed to link user." }, { status: 500 });
  }
}
