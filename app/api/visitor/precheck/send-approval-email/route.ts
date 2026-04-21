import { NextResponse } from "next/server";
import { sendVisitorPrecheckApprovalEmail } from "@/lib/visitor-precheck-email-senders";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await sendVisitorPrecheckApprovalEmail(body);
    if (result.ok === false) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send approval email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
