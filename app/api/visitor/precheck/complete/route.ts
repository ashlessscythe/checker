import { NextResponse } from "next/server";
import { serverDb, tx } from "@/lib/instantdb-server";
import { id } from "@instantdb/react";
import { requireAdminAPI } from "@/lib/instantdb-admin";

function generateVisitorBarcode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(req: Request) {
  try {
    const adminAPI = requireAdminAPI();
    const body = await req.json();
    const {
      inviteId,
      token,
      who,
      whoOther,
      why,
      whyOther,
      when,
      details,
    } = body || {};

    if (!inviteId || !token || !who || !why || !when) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const data = await adminAPI.query({
      visitorInvites: {
        $: {
          where: { id: inviteId, token },
        },
      },
    });

    const invite = (data as any)?.visitorInvites?.[0];
    if (!invite) {
      return NextResponse.json({ error: "Invalid invite." }, { status: 400 });
    }

    const now = Date.now();
    if (invite.status !== "pending" || now > invite.tokenExpiresAt) {
      return NextResponse.json(
        { error: "Token expired or already used." },
        { status: 400 }
      );
    }

    const finalWho = who === "Other" ? whoOther || "Other" : who;
    const finalWhy = why === "Other" ? whyOther || "Other" : why;
    const visitTimestamp = Number(when);

    const barcode = generateVisitorBarcode();
    const visitorId = id();
    const createdAt = now;

    // Ensure VISITOR department exists
    const deptData = await adminAPI.query({
      departments: {
        $: {
          where: { departmentId: "VISITOR" },
        },
      },
    });

    let visitorDeptId = "";
    if (!(deptData as any)?.departments || (deptData as any).departments.length === 0) {
      visitorDeptId = id();
      await serverDb.transact([
        tx.departments[visitorDeptId].update({
          name: "Visitors",
          departmentId: "VISITOR",
        }),
      ]);
    } else {
      visitorDeptId = (deptData as any).departments[0].id;
    }

    // Create backing user record with dept VISITOR
    await serverDb.transact([
      tx.users[visitorId].update({
        name: invite.email,
        email: invite.email,
        barcode,
        isAdmin: false,
        isAuth: false,
        deptId: visitorDeptId,
        createdAt,
        serverCreatedAt: createdAt,
        laptopSerial: undefined,
        purpose: finalWhy,
      }),
      tx.visitors[visitorId].update({
        name: invite.email,
        email: invite.email,
        barcode,
        visitDate: visitTimestamp,
        hostName: finalWho,
        reason: finalWhy,
        otherDetails: details || "",
        createdAt,
        precheckedAt: createdAt,
      }),
      tx.visitorInvites[invite.id].update({
        tokenUsedAt: createdAt,
        status: "completed",
        visitorId,
        hostOption: finalWho,
        reasonOption: finalWhy,
        visitDate: visitTimestamp,
      }),
      tx.auditLogs[id()].update({
        type: "precheck_completed",
        message: `Pre-check completed for ${invite.email}`,
        metadata: { inviteId: invite.id, visitorId, barcode },
        createdAt,
      }),
    ]);

    return NextResponse.json({ ok: true, barcode });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error completing pre-check." },
      { status: 500 }
    );
  }
}

