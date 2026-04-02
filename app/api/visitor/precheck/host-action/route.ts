import { NextResponse } from "next/server";
import { verifyHostPrecheckReviewToken } from "@/lib/visitor-precheck-host-token";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import {
  approveVisitorPrecheckRequestServer,
  rejectVisitorPrecheckRequestServer,
  type PrecheckRequestRow,
} from "@/lib/visitor-precheck-server-workflow";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = (body?.token as string | undefined)?.trim();
    const action = body?.action as string | undefined;
    const message = (body?.message as string | undefined)?.trim() ?? "";

    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const requestId = verifyHostPrecheckReviewToken(token);
    if (!requestId) {
      return NextResponse.json({ error: "Invalid or expired link." }, { status: 400 });
    }

    const adminAPI = requireAdminAPI();
    const rowData = await adminAPI.query({
      visitorPrecheckRequests: {
        $: {
          where: { id: requestId },
        },
      },
    });

    const row = (rowData as { visitorPrecheckRequests?: PrecheckRequestRow[] })
      ?.visitorPrecheckRequests?.[0];
    if (!row) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    if (row.status !== "pending") {
      return NextResponse.json(
        {
          error:
            row.status === "approved"
              ? "This request was already approved."
              : "This request is no longer pending.",
        },
        { status: 409 }
      );
    }

    if (action === "approve") {
      const result = await approveVisitorPrecheckRequestServer(adminAPI, row, {
        actor: "host",
        message,
      });
      if (result.ok === false) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, outcome: "approved" as const });
    }

    const rejectResult = await rejectVisitorPrecheckRequestServer(adminAPI, row, {
      actor: "host",
      message,
    });
    if (rejectResult.ok === false) {
      return NextResponse.json({ error: rejectResult.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, outcome: "rejected" as const });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error.";
    console.error("host-action", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
