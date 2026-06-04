import { NextResponse } from "next/server";
import { formatAdminApiError } from "@/lib/admin-api-error";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { clearStaleVendorCheckins } from "@/lib/vendor-admin-maintenance";
import { getStaleCheckinHoursForDisplay } from "@/lib/stale-checkin-duration";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const adminAPI = requireAdminAPI();
    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);
    const { checkedOut } = await clearStaleVendorCheckins(adminAPI, dryRun);
    return NextResponse.json({
      ok: true,
      dryRun,
      checkedOut,
      staleHours: getStaleCheckinHoursForDisplay(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: formatAdminApiError(e) },
      { status: 500 }
    );
  }
}
