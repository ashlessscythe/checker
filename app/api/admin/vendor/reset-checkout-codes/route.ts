import { NextResponse } from "next/server";
import { formatAdminApiError } from "@/lib/admin-api-error";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { releaseVendorCheckoutCodes } from "@/lib/vendor-admin-maintenance";
import { requireSignedInAdmin } from "@/lib/require-signed-in-admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const admin = await requireSignedInAdmin(req);
    if (admin.ok === false) return admin.response;
    const adminAPI = requireAdminAPI();
    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);
    const { released } = await releaseVendorCheckoutCodes(adminAPI, dryRun);
    return NextResponse.json({
      ok: true,
      dryRun,
      released,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: formatAdminApiError(e) },
      { status: 500 }
    );
  }
}
