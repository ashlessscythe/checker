import { tx } from "@instantdb/admin";
import { getStaleCheckinMaxDurationMs } from "@/lib/stale-checkin-duration";
import { userQualifiesForStaleAutoCheckout } from "@/lib/auto-checkout-logic";
import {
  isActiveVendorCheckoutCode,
  releasedVendorCheckoutCode,
} from "@/lib/vendor-checkout-code-release";
import {
  isUserCheckedInFromPunches,
  transactVendorCheckout,
} from "@/lib/vendor-kiosk-server";

type AdminAPI = ReturnType<
  typeof import("@/lib/instantdb-admin").requireAdminAPI
>;

type VendorCheckinRow = {
  id: string;
  sixDigitCode: string;
  checkedOutAt: number;
};

type OpenVendorCheckinRow = {
  id: string;
  checkedOutAt: number;
  user?: { id: string; punches?: PunchRow[] } | Array<{
    id: string;
    punches?: PunchRow[];
  }>;
};

type PunchRow = {
  type: string;
  timestamp: number;
  serverCreatedAt: number;
};

const TX_CHUNK = 80;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function listReleasableVendorCheckoutCodes(
  adminAPI: AdminAPI
): Promise<VendorCheckinRow[]> {
  const data = (await adminAPI.query({
    vendorCheckins: {},
  })) as { vendorCheckins?: VendorCheckinRow[] };

  return (data.vendorCheckins ?? []).filter(
    (row) =>
      typeof row.checkedOutAt === "number" &&
      row.checkedOutAt > 0 &&
      isActiveVendorCheckoutCode(row.sixDigitCode ?? "")
  );
}

export async function releaseVendorCheckoutCodes(
  adminAPI: AdminAPI,
  dryRun: boolean
): Promise<{ released: number }> {
  const rows = await listReleasableVendorCheckoutCodes(adminAPI);
  if (dryRun) return { released: rows.length };

  for (const batch of chunk(rows, TX_CHUNK)) {
    await adminAPI.transact(
      batch.map((row) =>
        tx.vendorCheckins[row.id].update({
          sixDigitCode: releasedVendorCheckoutCode(row.id),
        })
      )
    );
  }

  return { released: rows.length };
}

function linkedVendorUser(
  row: OpenVendorCheckinRow
): { id: string; punches?: PunchRow[] } | undefined {
  const u = row.user;
  if (!u) return undefined;
  return Array.isArray(u) ? u[0] : u;
}

export async function listStaleOpenVendorCheckins(
  adminAPI: AdminAPI,
  now = Date.now()
): Promise<
  Array<{
    checkinRowId: string;
    userId: string;
  }>
> {
  const maxMs = getStaleCheckinMaxDurationMs();
  const data = (await adminAPI.query({
    vendorCheckins: {
      $: { where: { checkedOutAt: 0 } },
      user: { punches: {} },
    },
  })) as unknown as { vendorCheckins?: OpenVendorCheckinRow[] };

  const stale: Array<{ checkinRowId: string; userId: string }> = [];

  for (const row of data.vendorCheckins ?? []) {
    const user = linkedVendorUser(row);
    if (!user?.id) continue;
    const punches = user.punches ?? [];
    if (!isUserCheckedInFromPunches(punches)) continue;
    if (!userQualifiesForStaleAutoCheckout(punches, now, maxMs)) continue;
    stale.push({ checkinRowId: row.id, userId: user.id });
  }

  return stale;
}

export async function clearStaleVendorCheckins(
  adminAPI: AdminAPI,
  dryRun: boolean,
  now = Date.now()
): Promise<{ checkedOut: number }> {
  const rows = await listStaleOpenVendorCheckins(adminAPI, now);
  if (dryRun) return { checkedOut: rows.length };

  for (const row of rows) {
    await transactVendorCheckout({
      adminAPI,
      now,
      userId: row.userId,
      checkinRowId: row.checkinRowId,
    });
  }

  return { checkedOut: rows.length };
}
