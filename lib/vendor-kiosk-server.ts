import { id, tx } from "@instantdb/admin";
import { ensureVendorDepartmentId } from "@/lib/vendor-department";

/** Keep in sync with `CheckActionType` / `checkInTypes` in `utils/checkInOut.ts` (server-safe copy). */
const CHECK_IN_TYPES = new Set([
  "checkin",
  "sys_checkin",
  "admin_checkin",
]);

type AdminAPI = ReturnType<
  typeof import("@/lib/instantdb-admin").requireAdminAPI
>;

export function normName(s: string): string {
  return s.trim().toLowerCase();
}

/** Random 6-digit string "100000".."999999". */
export function randomSixDigitCode(): string {
  const n = 100000 + Math.floor(Math.random() * 900000);
  return String(n);
}

export async function allocateUniqueVendorSixDigitCode(
  adminAPI: AdminAPI
): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const code = randomSixDigitCode();
    const { vendorCheckins } = (await adminAPI.query({
      vendorCheckins: {
        $: { where: { sixDigitCode: code } },
      },
    })) as { vendorCheckins?: unknown[] };
    if (!vendorCheckins?.length) return code;
  }
  throw new Error("Could not allocate a unique vendor code.");
}

type PunchRow = {
  type: string;
  timestamp: number;
  serverCreatedAt: number;
};

export function getLatestPunch(
  punches: PunchRow[] | undefined
): PunchRow | null {
  if (!punches?.length) return null;
  return [...punches].sort((a, b) => {
    const sa = a.serverCreatedAt ?? 0;
    const sb = b.serverCreatedAt ?? 0;
    if (sa !== sb) return sb - sa;
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  })[0];
}

export function isUserCheckedInFromPunches(
  punches: PunchRow[] | undefined
): boolean {
  const last = getLatestPunch(punches);
  if (!last) return false;
  return CHECK_IN_TYPES.has(last.type);
}

const VENDOR_BARCODE_PREFIX = "VENDOR-";

export function syntheticVendorEmail(userId: string): string {
  return `vendor+${userId}@checker-vendor.internal`;
}

export function syntheticVendorBarcode(userId: string): string {
  return `${VENDOR_BARCODE_PREFIX}${userId}`;
}

export type VendorCheckinContext = {
  adminAPI: AdminAPI;
  now: number;
  firstName: string;
  lastName: string;
  companyDisplayName: string;
  vendorListId: string;
  reasonDisplay: string;
  sixDigitCode: string;
};

/**
 * Creates VENDOR-dept user, check-in punch, vendorCheckins row (linked to user).
 */
export async function transactVendorCheckin(ctx: VendorCheckinContext) {
  const {
    adminAPI,
    now,
    firstName,
    lastName,
    companyDisplayName,
    vendorListId,
    reasonDisplay,
    sixDigitCode,
  } = ctx;

  const vendorDeptId = await ensureVendorDepartmentId(adminAPI);
  const userId = id();
  const checkinRowId = id();
  const punchId = id();
  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

  await adminAPI.transact([
    tx.users[userId].update({
      name: displayName,
      email: syntheticVendorEmail(userId),
      barcode: syntheticVendorBarcode(userId),
      isAdmin: false,
      isAuth: false,
      deptId: vendorDeptId,
      createdAt: now,
      serverCreatedAt: now,
      lastLoginAt: now,
      laptopSerial: "",
      purpose: reasonDisplay,
    }),
    tx.punches[punchId].update({
      type: "checkin",
      timestamp: now,
      serverCreatedAt: now,
      isSystemGenerated: false,
      isAdminGenerated: false,
      userId,
      device: "vendor_kiosk",
    }),
    tx.vendorCheckins[checkinRowId]
      .update({
        sixDigitCode,
        companyDisplayName,
        vendorListId,
        reasonDisplay,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        firstNameNorm: normName(firstName),
        lastNameNorm: normName(lastName),
        checkedOutAt: 0,
        createdAt: now,
      })
      .link({ user: userId }),
  ]);

  return { userId, checkinRowId, displayName, sixDigitCode };
}

export async function transactVendorCheckout(params: {
  adminAPI: AdminAPI;
  now: number;
  userId: string;
  checkinRowId: string;
}) {
  const { adminAPI, now, userId, checkinRowId } = params;
  const punchId = id();
  await adminAPI.transact([
    tx.punches[punchId].update({
      type: "checkout",
      timestamp: now,
      serverCreatedAt: now,
      isSystemGenerated: false,
      isAdminGenerated: false,
      userId,
      device: "vendor_kiosk",
    }),
    tx.vendorCheckins[checkinRowId].update({
      checkedOutAt: now,
    }),
  ]);
}
