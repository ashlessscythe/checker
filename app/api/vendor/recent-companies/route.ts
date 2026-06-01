import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { getVendorLobbyEnabledFromDb } from "@/lib/kiosk-lobby-settings-server";
import { uniqueRecentVendorListIds } from "@/lib/vendor-kiosk-company-sort";

export const runtime = "nodejs";

/** Recent vendor list ids for kiosk company dropdown ordering (server-side read). */
export async function GET() {
  try {
    const adminAPI = requireAdminAPI();
    if (!(await getVendorLobbyEnabledFromDb(adminAPI))) {
      return NextResponse.json({ vendorIds: [] });
    }

    const data = (await adminAPI.query({
      vendorCheckins: {
        $: {
          order: { createdAt: "desc" },
          first: 80,
        },
      },
    })) as {
      vendorCheckins?: Array<{ vendorListId?: string; createdAt?: number }>;
    };

    const vendorIds = uniqueRecentVendorListIds(data.vendorCheckins ?? []);
    return NextResponse.json({ vendorIds });
  } catch (err) {
    console.error("vendor recent-companies:", err);
    return NextResponse.json({ vendorIds: [] });
  }
}
