import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { signProtocolViewTicket } from "@/lib/visitor-precheck-protocol-view-ticket";

const PROTOCOL_KEY = "default";

/**
 * Issues a short-lived ticket so the lobby kiosk can open the protocol PDF
 * without an invite token (see protocol-document GET).
 */
export async function POST() {
  try {
    const adminAPI = requireAdminAPI();
    const data = await adminAPI.query({
      visitorProtocolDocuments: {
        $: {
          where: { key: PROTOCOL_KEY },
        },
      },
    });
    const doc = (data as { visitorProtocolDocuments?: unknown[] })?.visitorProtocolDocuments?.[0];
    if (!doc) {
      return NextResponse.json({ error: "Protocol not found." }, { status: 404 });
    }

    const ticket = signProtocolViewTicket(900);
    return NextResponse.json({ ok: true, ticket });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
