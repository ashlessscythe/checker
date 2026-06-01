/**
 * Vendor kiosk visit CSV report (admin backup tab).
 */

export const VENDOR_PUNCH_REPORT_HEADERS = [
  "Company",
  "Reason",
  "First Name",
  "Last Name",
  "Check-in (MST)",
  "Check-out (MST)",
  "Elapsed",
  "On Site",
  "Checkout Code",
] as const;

export const VENDOR_CHECK_IN_TYPES = new Set([
  "checkin",
  "sys_checkin",
  "admin_checkin",
]);

export const VENDOR_CHECK_OUT_TYPES = new Set([
  "checkout",
  "sys_checkout",
  "admin_checkout",
]);

export type VendorPunchLike = {
  type: string;
  timestamp?: number;
  serverCreatedAt?: number;
};

export type VendorCheckinReportRow = {
  id?: string;
  createdAt?: number;
  checkedOutAt?: number;
  companyDisplayName?: string;
  reasonDisplay?: string;
  firstName?: string;
  lastName?: string;
  sixDigitCode?: string;
  user?: { id: string } | { id: string }[] | null;
};

export function escapeCsv(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatElapsed(ms: number): string {
  if (!ms || ms < 0 || !Number.isFinite(ms)) return "";
  const totalMins = Math.floor(ms / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function punchTime(punch: VendorPunchLike | null | undefined): number {
  return punch?.serverCreatedAt || punch?.timestamp || 0;
}

export function findLatestPunchByTypes(
  punches: VendorPunchLike[] | undefined,
  types: Set<string>
): VendorPunchLike | null {
  if (!punches?.length) return null;
  const matches = punches.filter((p) => types.has(p.type));
  if (!matches.length) return null;
  return matches.sort((a, b) => punchTime(b) - punchTime(a))[0];
}

export function linkedEntity<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

/** MST-ish local ISO string (matches admin backup punch report). */
export function convertTimestampToMST(timestamp: number): string {
  const date = new Date(timestamp);
  return (
    date
      .toLocaleString("sv", { timeZone: "America/Denver" })
      .replace(" ", "T") + "-07:00"
  );
}

export function groupPunchesByUserId(
  punches: Array<VendorPunchLike & { userId?: string }>
): Record<string, VendorPunchLike[]> {
  const grouped: Record<string, VendorPunchLike[]> = {};
  for (const p of punches) {
    const userId = p.userId;
    if (!userId) continue;
    if (!grouped[userId]) grouped[userId] = [];
    grouped[userId].push(p);
  }
  return grouped;
}

export type VendorPunchReportCsvRow = Record<
  (typeof VENDOR_PUNCH_REPORT_HEADERS)[number],
  string
>;

export function buildVendorPunchReportRows(params: {
  checkins: VendorCheckinReportRow[];
  punchesByUserId: Record<string, VendorPunchLike[]>;
  cutoffMs: number;
  formatTimestamp?: (ms: number) => string;
}): VendorPunchReportCsvRow[] {
  const formatTimestamp =
    params.formatTimestamp ?? convertTimestampToMST;

  return params.checkins
    .filter((c) => (c.createdAt || 0) >= params.cutoffMs)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map((checkin) => {
      const user = linkedEntity(checkin.user);
      const punches = user?.id ? params.punchesByUserId[user.id] ?? [] : [];
      const checkinPunch = findLatestPunchByTypes(
        punches,
        VENDOR_CHECK_IN_TYPES
      );
      const checkoutPunch = findLatestPunchByTypes(
        punches,
        VENDOR_CHECK_OUT_TYPES
      );

      const checkInMs =
        checkin.createdAt || punchTime(checkinPunch) || 0;
      const checkedOutAt = checkin.checkedOutAt || 0;
      const checkOutMs =
        checkedOutAt > 0
          ? checkedOutAt
          : punchTime(checkoutPunch) || 0;
      const onSite = checkedOutAt === 0;
      const elapsedMs =
        checkOutMs > 0 && checkInMs > 0 ? checkOutMs - checkInMs : 0;

      return {
        Company: checkin.companyDisplayName || "",
        Reason: checkin.reasonDisplay || "",
        "First Name": checkin.firstName || "",
        "Last Name": checkin.lastName || "",
        "Check-in (MST)": checkInMs ? formatTimestamp(checkInMs) : "",
        "Check-out (MST)": checkOutMs ? formatTimestamp(checkOutMs) : "",
        Elapsed: elapsedMs ? formatElapsed(elapsedMs) : "",
        "On Site": onSite ? "Yes" : "No",
        "Checkout Code": checkin.sixDigitCode || "",
      };
    });
}

export function buildVendorPunchReportCsv(
  rows: VendorPunchReportCsvRow[]
): string {
  const headerLine = VENDOR_PUNCH_REPORT_HEADERS.map((h) =>
    escapeCsv(h)
  ).join(",");
  const body = rows.map((row) =>
    VENDOR_PUNCH_REPORT_HEADERS.map((h) => escapeCsv(row[h])).join(",")
  );
  return `\ufeff${[headerLine, ...body].join("\n")}`;
}

export function vendorPunchReportCutoffMs(reportDays: number, now = Date.now()) {
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - reportDays);
  return cutoffDate.getTime();
}
