import { NextResponse } from "next/server";
import { verifyHostPrecheckReviewToken } from "@/lib/visitor-precheck-host-token";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { visitorPrecheckDisplayName } from "@/lib/visitor-precheck-display";
import { formatVisitorPrecheckWhen } from "@/lib/visitor-precheck-datetime";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t")?.trim();
    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
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

    const row = (rowData as { visitorPrecheckRequests?: Array<Record<string, unknown>> })
      ?.visitorPrecheckRequests?.[0];
    if (!row) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    const status = String(row.status || "");
    if (status === "approved") {
      return NextResponse.json({
        state: "approved" as const,
        message: "This visit was already approved.",
      });
    }
    if (status === "rejected") {
      return NextResponse.json({
        state: "rejected" as const,
        message: "This visit was already declined.",
      });
    }
    if (status !== "pending") {
      return NextResponse.json({ error: "Invalid request state." }, { status: 400 });
    }

    const email = String(row.email || "");
    const visitorDisplayName = visitorPrecheckDisplayName({
      visitorFirstName: row.visitorFirstName as string | undefined,
      visitorLastName: row.visitorLastName as string | undefined,
      invitedName: row.invitedName as string | undefined,
      email,
    });

    const requestSource = String(row.requestSource || "");
    const sourceLabel =
      requestSource === "kiosk_register"
        ? "Lobby check-in tablet"
        : requestSource === "admin"
          ? "Pre-check invitation (email)"
          : "Lobby check-in (email link)";

    const visitDate = typeof row.visitDate === "number" ? row.visitDate : 0;
    const submittedAt = typeof row.submittedAt === "number" ? row.submittedAt : 0;

    return NextResponse.json({
      state: "pending" as const,
      token,
      visitorDisplayName,
      visitorEmail: email,
      visitorCompanyName: String(row.visitorCompanyName || "").trim(),
      who: String(row.who || ""),
      reason: String(row.reason || ""),
      otherDetails: String(row.otherDetails || "").trim(),
      visitDate,
      whenFormatted: formatVisitorPrecheckWhen(visitDate) || "—",
      submittedAt,
      submittedFormatted:
        submittedAt > 0 ? new Date(submittedAt).toLocaleString() : "—",
      requestSourceLabel: sourceLabel,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    console.error("host-review GET", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
