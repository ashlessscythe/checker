import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { sendVisitorPrecheckApprovalInternalNotify } from "@/lib/visitor-precheck-email-senders";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const adminAPI = requireAdminAPI();
    const result = await sendVisitorPrecheckApprovalInternalNotify(adminAPI, body);
    if (result.ok === false) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, sent: result.sent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send internal notify.";
    console.error("send-approval-internal-notify", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
