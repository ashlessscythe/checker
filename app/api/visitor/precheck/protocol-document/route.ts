import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { assertPrecheckLinkActive } from "@/lib/visitor-precheck-link-validation";
import { verifyProtocolViewTicket } from "@/lib/visitor-precheck-protocol-view-ticket";

const PROTOCOL_KEY = "default";

async function loadProtocolBytes(): Promise<
  | { ok: true; buf: Buffer; mimeType: string; asciiName: string }
  | { ok: false; status: number; error: string }
> {
  const adminAPI = requireAdminAPI();
  const data = await adminAPI.query({
    visitorProtocolDocuments: {
      $: {
        where: { key: PROTOCOL_KEY },
      },
    },
  });
  const protocol = (data as { visitorProtocolDocuments?: Array<Record<string, unknown>> })
    ?.visitorProtocolDocuments?.[0];
  const contentBase64 =
    typeof protocol?.contentBase64 === "string" ? protocol.contentBase64.trim() : "";
  if (!protocol || !contentBase64) {
    return { ok: false, status: 404, error: "Protocol not found." };
  }

  const mimeType =
    typeof protocol.mimeType === "string" && protocol.mimeType.trim()
      ? protocol.mimeType.trim()
      : "application/octet-stream";
  const rawName =
    typeof protocol.fileName === "string" && protocol.fileName.trim()
      ? protocol.fileName.trim()
      : "visitor-protocol";
  const asciiName =
    rawName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'") || "visitor-protocol";

  return { ok: true, buf: Buffer.from(contentBase64, "base64"), mimeType, asciiName };
}

/**
 * Serves the default visitor protocol only with a valid pre-check invite token
 * or a short-lived ticket from POST /api/visitor/precheck/protocol-view-ticket.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim() || "";
    const ticket = url.searchParams.get("ticket")?.trim() || "";

    if (token) {
      const gate = await assertPrecheckLinkActive(token);
      if (gate.ok === false) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
      }
      if (!gate.payload.protocolRequired) {
        return NextResponse.json(
          {
            error:
              "This pre-check link does not include visitor protocol access.",
          },
          { status: 403 }
        );
      }
    } else if (ticket) {
      if (!verifyProtocolViewTicket(ticket)) {
        return NextResponse.json(
          { error: "Invalid or expired access. Request a new link from the kiosk." },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Access denied. Open the protocol from your pre-check page or kiosk." },
        { status: 401 }
      );
    }

    const loaded = await loadProtocolBytes();
    if (loaded.ok === false) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    return new NextResponse(loaded.buf, {
      status: 200,
      headers: {
        "Content-Type": loaded.mimeType,
        "Content-Disposition": `inline; filename="${loaded.asciiName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
