import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/instantdb-admin";

/** Public read for kiosk: whether a default visitor protocol exists (requires acknowledgment). */
export async function GET() {
  try {
    const adminAPI = requireAdminAPI();
    const data = await adminAPI.query({
      visitorProtocolDocuments: {
        $: {
          where: { key: "default" },
        },
      },
    });
    const doc = (data as { visitorProtocolDocuments?: unknown[] })?.visitorProtocolDocuments?.[0];
    return NextResponse.json({
      ok: true,
      requiresVisitorProtocol: Boolean(doc),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json(
      { ok: false, requiresVisitorProtocol: false, error: message },
      { status: 500 }
    );
  }
}
