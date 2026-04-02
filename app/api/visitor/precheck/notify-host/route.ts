import { NextResponse } from "next/server";
import { notifyHostForPrecheckRequestIfConfigured } from "@/lib/visitor-precheck-notify-host";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requestId = (body?.requestId as string | undefined)?.trim();
    const precheckToken = (body?.precheckToken as string | undefined)?.trim();

    if (!requestId || !precheckToken) {
      return NextResponse.json(
        { error: "Missing requestId or precheckToken." },
        { status: 400 }
      );
    }

    await notifyHostForPrecheckRequestIfConfigured(requestId, {
      precheckToken,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    console.error("notify-host", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
