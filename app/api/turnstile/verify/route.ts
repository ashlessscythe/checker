import { NextResponse } from "next/server";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = (body?.token as string | undefined) ?? "";
    const action = (body?.action as string | undefined) ?? undefined;
    const cdata = (body?.cdata as string | undefined) ?? undefined;

    // Best-effort IP extraction. Cloudflare adds CF-Connecting-IP; proxies may add x-forwarded-for.
    const remoteIp =
      req.headers.get("CF-Connecting-IP") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")?.[0]?.trim() ||
      null;

    const result = await verifyTurnstileToken({ token, remoteIp, action, cdata });
    if (result.ok !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          codes: "codes" in result ? result.codes : undefined,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

