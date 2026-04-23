import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import {
  isUserCheckedInFromPunches,
  normName,
  transactVendorCheckout,
} from "@/lib/vendor-kiosk-server";

export const runtime = "nodejs";

type UserWithPunches = {
  id: string;
  punches?: Array<{
    type: string;
    timestamp: number;
    serverCreatedAt: number;
  }>;
};

export async function POST(req: Request) {
  try {
    const adminAPI = requireAdminAPI();
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode as string | undefined;

    if (mode === "code") {
      const raw = String(body?.sixDigitCode ?? "").replace(/\D/g, "");
      if (raw.length !== 6) {
        return NextResponse.json(
          { error: "Enter your 6-digit checkout number (digits only)." },
          { status: 400 }
        );
      }

      const companyMode = body?.companyMode as string | undefined;
      const vendorId = String(body?.vendorId ?? "").trim();
      const companyOther = String(body?.companyOther ?? "").trim();

      if (companyMode !== "vendor" && companyMode !== "other") {
        return NextResponse.json(
          { error: "Please choose your company." },
          { status: 400 }
        );
      }
      if (companyMode === "vendor" && !vendorId) {
        return NextResponse.json(
          { error: "Please choose your company." },
          { status: 400 }
        );
      }
      if (companyMode === "other" && !companyOther) {
        return NextResponse.json(
          { error: "Please enter the company name." },
          { status: 400 }
        );
      }

      const data = (await adminAPI.query({
        vendorCheckins: {
          $: { where: { sixDigitCode: raw } },
          user: {},
        },
      })) as {
        vendorCheckins?: Array<{
          id: string;
          checkedOutAt: number;
          vendorListId: string;
          companyDisplayName: string;
          user?: UserWithPunches | UserWithPunches[];
        }>;
      };

      const row = data.vendorCheckins?.[0];
      if (!row || row.checkedOutAt !== 0) {
        return NextResponse.json(
          {
            error:
              "That number was not found, or this visit is already checked out. Check the number and try again.",
          },
          { status: 400 }
        );
      }

      const companyOk =
        companyMode === "vendor"
          ? row.vendorListId === vendorId
          : !row.vendorListId &&
            normName(row.companyDisplayName) === normName(companyOther);
      if (!companyOk) {
        return NextResponse.json(
          {
            error:
              "That number does not match the company you selected. Check the company and the number.",
          },
          { status: 400 }
        );
      }

      const u = row.user;
      const user = (Array.isArray(u) ? u[0] : u) as UserWithPunches | undefined;
      if (!user?.id) {
        return NextResponse.json(
          { error: "Something went wrong. Please ask a staff member for help." },
          { status: 500 }
        );
      }

      const punchData = (await adminAPI.query({
        punches: {
          $: {
            where: { userId: user.id },
            order: { serverCreatedAt: "desc" },
          },
        },
      })) as unknown as { punches?: UserWithPunches["punches"] };

      if (!isUserCheckedInFromPunches(punchData.punches)) {
        return NextResponse.json(
          {
            error:
              "This visit is not currently checked in. If you need help, ask a staff member.",
          },
          { status: 400 }
        );
      }

      const now = Date.now();
      await transactVendorCheckout({
        adminAPI,
        now,
        userId: user.id,
        checkinRowId: row.id,
      });

      return NextResponse.json({ ok: true });
    }

    if (mode === "forgot") {
      const firstName = String(body?.firstName ?? "").trim();
      const lastName = String(body?.lastName ?? "").trim();
      const companyMode = body?.companyMode as string | undefined;
      const vendorId = String(body?.vendorId ?? "").trim();
      const companyOther = String(body?.companyOther ?? "").trim();

      if (!firstName || !lastName) {
        return NextResponse.json(
          { error: "First name and last name are required." },
          { status: 400 }
        );
      }

      if (companyMode !== "vendor" && companyMode !== "other") {
        return NextResponse.json(
          { error: "Please choose your company." },
          { status: 400 }
        );
      }

      const fn = normName(firstName);
      const ln = normName(lastName);

      const open = (await adminAPI.query({
        vendorCheckins: {
          $: { where: { checkedOutAt: 0 } },
          user: {},
        },
      })) as {
        vendorCheckins?: Array<{
          id: string;
          vendorListId: string;
          companyDisplayName: string;
          firstNameNorm: string;
          lastNameNorm: string;
          user?: UserWithPunches | UserWithPunches[];
        }>;
      };

      const candidates = (open.vendorCheckins ?? []).filter((c) => {
        if (c.firstNameNorm !== fn || c.lastNameNorm !== ln) return false;
        if (companyMode === "vendor") {
          if (!vendorId) return false;
          return c.vendorListId === vendorId;
        }
        if (!companyOther.trim()) return false;
        return (
          !c.vendorListId &&
          normName(c.companyDisplayName) === normName(companyOther)
        );
      });

      if (candidates.length === 0) {
        return NextResponse.json(
          {
            error:
              "No open vendor visit matched those details. Check spelling or ask a staff member.",
          },
          { status: 400 }
        );
      }

      if (candidates.length > 1) {
        return NextResponse.json(
          {
            error:
              "More than one open visit matched. Please ask a staff member to check you out.",
          },
          { status: 400 }
        );
      }

      const row = candidates[0];
      const u = row.user;
      const user = (Array.isArray(u) ? u[0] : u) as UserWithPunches | undefined;
      if (!user?.id) {
        return NextResponse.json(
          { error: "Something went wrong. Please ask a staff member for help." },
          { status: 500 }
        );
      }

      const punchData = (await adminAPI.query({
        punches: {
          $: {
            where: { userId: user.id },
            order: { serverCreatedAt: "desc" },
          },
        },
      })) as unknown as { punches?: UserWithPunches["punches"] };

      if (!isUserCheckedInFromPunches(punchData.punches)) {
        return NextResponse.json(
          {
            error:
              "This visit is not currently checked in. If you need help, ask a staff member.",
          },
          { status: 400 }
        );
      }

      const now = Date.now();
      await transactVendorCheckout({
        adminAPI,
        now,
        userId: user.id,
        checkinRowId: row.id,
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid checkout mode." }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
