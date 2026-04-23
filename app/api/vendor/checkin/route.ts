import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { getVendorLobbyEnabledFromDb } from "@/lib/kiosk-lobby-settings-server";
import {
  allocateUniqueVendorSixDigitCode,
  transactVendorCheckin,
} from "@/lib/vendor-kiosk-server";

export const runtime = "nodejs";

type AdminAPI = ReturnType<typeof requireAdminAPI>;

async function loadVendor(adminAPI: AdminAPI, vendorId: string) {
  const data = (await adminAPI.query({
    vendors: { $: { where: { id: vendorId } } },
  })) as { vendors?: Array<{ id: string; name: string; isActive: boolean }> };
  return data.vendors?.[0] ?? null;
}

async function loadVendorReason(
  adminAPI: AdminAPI,
  reasonId: string,
  expectedVendorId: string
) {
  const data = (await adminAPI.query({
    vendorReasons: {
      $: { where: { id: reasonId } },
      vendor: {},
    },
  })) as {
    vendorReasons?: Array<{
      id: string;
      label: string;
      isActive: boolean;
      vendor?: { id: string } | { id: string }[];
    }>;
  };
  const row = data.vendorReasons?.[0];
  if (!row) return null;
  const v = row.vendor;
  const vendorRef = Array.isArray(v) ? v[0] : v;
  if (!vendorRef || vendorRef.id !== expectedVendorId) return null;
  return row;
}

export async function POST(req: Request) {
  try {
    const adminAPI = requireAdminAPI();
    if (!(await getVendorLobbyEnabledFromDb(adminAPI))) {
      return NextResponse.json(
        { error: "Vendor check-in is disabled." },
        { status: 403 }
      );
    }
    const body = await req.json().catch(() => ({}));

    const firstName = String(body?.firstName ?? "").trim();
    const lastName = String(body?.lastName ?? "").trim();
    const companyMode = body?.companyMode as string | undefined;
    const vendorId = String(body?.vendorId ?? "").trim();
    const companyOther = String(body?.companyOther ?? "").trim();
    const reasonMode = body?.reasonMode as string | undefined;
    const vendorReasonId = String(body?.vendorReasonId ?? "").trim();
    const reasonOther = String(body?.reasonOther ?? "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required." },
        { status: 400 }
      );
    }

    if (companyMode !== "vendor" && companyMode !== "other") {
      return NextResponse.json(
        { error: "Invalid company selection." },
        { status: 400 }
      );
    }

    let companyDisplayName = "";
    let vendorListId = "";

    if (companyMode === "vendor") {
      if (!vendorId) {
        return NextResponse.json(
          { error: "Please choose a company." },
          { status: 400 }
        );
      }
      const vendor = await loadVendor(adminAPI, vendorId);
      if (!vendor || !vendor.isActive) {
        return NextResponse.json(
          { error: "That company is not available." },
          { status: 400 }
        );
      }
      companyDisplayName = vendor.name.trim();
      vendorListId = vendor.id;
    } else {
      if (!companyOther) {
        return NextResponse.json(
          { error: "Please enter the company name." },
          { status: 400 }
        );
      }
      companyDisplayName = companyOther;
      vendorListId = "";
    }

    let reasonDisplay = "";

    if (companyMode === "vendor") {
      if (reasonMode !== "reason" && reasonMode !== "other") {
        return NextResponse.json(
          { error: "Please choose a reason for your visit." },
          { status: 400 }
        );
      }
      if (reasonMode === "reason") {
        if (!vendorReasonId) {
          return NextResponse.json(
            { error: "Please choose a reason from the list." },
            { status: 400 }
          );
        }
        const reasonRow = await loadVendorReason(
          adminAPI,
          vendorReasonId,
          vendorId
        );
        if (!reasonRow || !reasonRow.isActive) {
          return NextResponse.json(
            { error: "That reason is not available for this company." },
            { status: 400 }
          );
        }
        reasonDisplay = reasonRow.label.trim();
      } else {
        if (!reasonOther) {
          return NextResponse.json(
            { error: "Please describe your reason for visiting." },
            { status: 400 }
          );
        }
        reasonDisplay = `Other: ${reasonOther.trim()}`;
      }
    } else {
      if (!reasonOther.trim()) {
        return NextResponse.json(
          { error: "Please describe your reason for visiting." },
          { status: 400 }
        );
      }
      reasonDisplay = `Other: ${reasonOther.trim()}`;
    }

    const now = Date.now();
    const sixDigitCode = await allocateUniqueVendorSixDigitCode(adminAPI);

    const { displayName } = await transactVendorCheckin({
      adminAPI,
      now,
      firstName,
      lastName,
      companyDisplayName,
      vendorListId,
      reasonDisplay,
      sixDigitCode,
    });

    return NextResponse.json({
      ok: true,
      sixDigitCode,
      displayName,
      message:
        "Your checkout number is below. Please remember it. You will need this number when you leave.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
