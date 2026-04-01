import { NextResponse } from "next/server";
import { id, tx } from "@instantdb/admin";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { signPrecheckToken } from "@/lib/visitor-precheck-token";

export const runtime = "nodejs";

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const adminAPI = requireAdminAPI();
    const body = await req.json();

    const email = (body?.email as string | undefined)?.trim().toLowerCase();
    const visitorFirstName =
      (body?.visitorFirstName as string | undefined)?.trim() ?? "";
    const visitorLastName =
      (body?.visitorLastName as string | undefined)?.trim() ?? "";
    const visitorCompanyName =
      (body?.visitorCompanyName as string | undefined)?.trim() ?? "";
    const who = (body?.who as string | undefined)?.trim() ?? "";
    const reason = (body?.reason as string | undefined)?.trim() ?? "";
    const otherDetails = (body?.otherDetails as string | undefined)?.trim() ?? "";
    const protocolAcknowledged = Boolean(body?.protocolAcknowledged);

    const protocolData = await adminAPI.query({
      visitorProtocolDocuments: {
        $: {
          where: { key: "default" },
        },
      },
    });
    const protocolDoc = (protocolData as { visitorProtocolDocuments?: unknown[] })
      ?.visitorProtocolDocuments?.[0];
    const protocolRequired = Boolean(protocolDoc);

    if (protocolRequired && !protocolAcknowledged) {
      return NextResponse.json(
        { error: "You must acknowledge the visitor protocol before submitting." },
        { status: 400 }
      );
    }

    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }
    if (!visitorFirstName || !visitorLastName) {
      return NextResponse.json(
        { error: "First and last name are required." },
        { status: 400 }
      );
    }
    if (!visitorCompanyName) {
      return NextResponse.json(
        { error: "Company name is required." },
        { status: 400 }
      );
    }
    if (!who || !reason) {
      return NextResponse.json(
        { error: "Host and reason for visit are required." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const displayName = `${visitorFirstName} ${visitorLastName}`;
    const token = signPrecheckToken({
      email,
      name: displayName,
      source: "kiosk_register",
      protocolRequired,
      issuedAt: now,
    });

    const reqId = id();

    await adminAPI.transact([
      tx.visitorPrecheckRequests[reqId].update({
        token,
        email,
        status: "pending",

        visitorFirstName,
        visitorLastName,
        visitorCompanyName,
        who,
        reason,
        otherDetails,
        visitDate: now,

        submittedAt: now,
        approvedAt: 0,
        rejectedAt: 0,
        approvedBy: "",
        rejectedBy: "",
        adminMessage: "",
        rejectionMessage: "",

        visitorBarcode: "",
        visitorUserId: "",

        requestSource: "kiosk_register",
        invitedName: displayName,
        protocolRequired,
        protocolAcknowledgedAt: protocolRequired ? now : 0,

        createdAt: now,
        lastUpdatedAt: now,
      }),
    ]);

    try {
      await fetch(`${appBaseUrl}/api/visitor/precheck/send-pending-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token,
          visitorFirstName,
          visitorLastName,
          visitorCompanyName,
          who,
          reason,
          whenTs: now,
          details: otherDetails,
          invitedName: displayName,
          protocolRequired,
          requestSource: "kiosk_register",
        }),
      });
    } catch (e) {
      console.error("kiosk-register: send-pending-email fetch failed", e);
    }

    return NextResponse.json({ ok: true, token });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error during kiosk registration." },
      { status: 500 }
    );
  }
}
