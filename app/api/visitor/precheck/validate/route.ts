import { NextResponse } from "next/server";
import { verifyPrecheckToken } from "@/lib/visitor-precheck-token";
import { requireAdminAPI } from "@/lib/instantdb-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body?.token as string | undefined;

    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }

    const payload = verifyPrecheckToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Invalid token." }, { status: 400 });
    }

    const now = Date.now();
    const issuedAt = payload.iat;
    const expiresAt = issuedAt + 24 * 60 * 60 * 1000;
    if (now > expiresAt) {
      return NextResponse.json(
        { error: "Token expired or already used." },
        { status: 400 }
      );
    }

    try {
      const adminAPI = requireAdminAPI();
      const revokedData = await adminAPI.query({
        revokedPrecheckTokens: {
          $: {
            where: { token },
          },
        },
      });
      const revoked = (revokedData as { revokedPrecheckTokens?: unknown[] })
        ?.revokedPrecheckTokens;
      if (revoked && revoked.length > 0) {
        return NextResponse.json(
          {
            error:
              "This pre-check link is no longer valid. Ask your host for a new invitation if you still need access.",
          },
          { status: 400 }
        );
      }
    } catch (revokeCheckErr) {
      console.error("validate: revoked token lookup failed", revokeCheckErr);
    }

    let visitRecordAt: number | undefined;
    if (payload.source === "kiosk_register") {
      try {
        const adminAPI = requireAdminAPI();
        const rowData = await adminAPI.query({
          visitorPrecheckRequests: {
            $: {
              where: { token },
            },
          },
        });
        const row = (rowData as { visitorPrecheckRequests?: Array<{ visitDate?: number }> })
          ?.visitorPrecheckRequests?.[0];
        if (typeof row?.visitDate === "number" && row.visitDate > 0) {
          visitRecordAt = row.visitDate;
        }
      } catch (lookupErr) {
        console.error("validate: kiosk_register visitDate lookup failed", lookupErr);
      }
    }

    return NextResponse.json({
      email: payload.email,
      name: payload.name,
      source: payload.source,
      protocolRequired: payload.protocolRequired,
      iat: issuedAt,
      ...(visitRecordAt != null ? { visitRecordAt } : {}),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error validating token." },
      { status: 500 }
    );
  }
}
