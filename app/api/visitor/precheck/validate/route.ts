import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { assertPrecheckLinkActive } from "@/lib/visitor-precheck-link-validation";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body?.token as string | undefined;

    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }

    const gate = await assertPrecheckLinkActive(token);
    if (gate.ok === false) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    const payload = gate.payload;
    const issuedAt = payload.iat;

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
