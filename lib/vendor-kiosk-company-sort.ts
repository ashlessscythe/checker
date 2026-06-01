/** How far back to treat a vendor as "recently added" in the kiosk company list. */
export const VENDOR_RECENTLY_ADDED_MS = 14 * 24 * 60 * 60 * 1000;

/** Max vendors to pin from recent check-ins (unique companies, most recent first). */
export const VENDOR_RECENT_USED_PIN_LIMIT = 12;

/** Max newly created vendors to pin when there is no recent usage yet. */
export const VENDOR_RECENTLY_ADDED_PIN_LIMIT = 8;

export type VendorForCompanySort = {
  id: string;
  name: string;
  createdAt?: number;
};

export type VendorCheckinForSort = {
  vendorListId?: string;
  createdAt?: number;
};

/** Unique vendor ids from check-ins, newest visit first. Skips blank ids ("Other"). */
export function uniqueRecentVendorListIds(
  checkins: VendorCheckinForSort[],
  limit = VENDOR_RECENT_USED_PIN_LIMIT
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const sorted = [...checkins].sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
  );
  for (const c of sorted) {
    const id = String(c.vendorListId ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
    if (ordered.length >= limit) break;
  }
  return ordered;
}

/** Vendor ids created within the recent window, newest first. */
export function recentlyAddedVendorIds(
  vendors: VendorForCompanySort[],
  recentlyAddedMs = VENDOR_RECENTLY_ADDED_MS,
  now = Date.now(),
  maxCount = VENDOR_RECENTLY_ADDED_PIN_LIMIT
): string[] {
  const cutoff = now - recentlyAddedMs;
  return vendors
    .filter((v) => (v.createdAt ?? 0) >= cutoff)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, maxCount)
    .map((v) => v.id);
}

function compareVendorNames(a: VendorForCompanySort, b: VendorForCompanySort) {
  return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
}

/**
 * Kiosk company dropdown order:
 * 1. Recently used (from check-ins), most recent first
 * 2. Then recently added vendors not already pinned
 * 3. Remaining vendors A–Z
 *
 * When there is no recent usage and nothing recently added, the full list is A–Z.
 */
export function sortVendorsForKioskDropdown<T extends VendorForCompanySort>(
  vendors: T[],
  recentVendorIds: string[],
  recentlyAddedIds: string[]
): T[] {
  if (!recentVendorIds.length && !recentlyAddedIds.length) {
    return [...vendors].sort(compareVendorNames);
  }

  const priority: string[] = [];
  const seen = new Set<string>();
  for (const id of recentVendorIds) {
    if (!seen.has(id)) {
      seen.add(id);
      priority.push(id);
    }
  }
  for (const id of recentlyAddedIds) {
    if (!seen.has(id)) {
      seen.add(id);
      priority.push(id);
    }
  }

  const byId = new Map(vendors.map((v) => [v.id, v]));
  const result: T[] = [];
  for (const id of priority) {
    const v = byId.get(id);
    if (v) {
      result.push(v);
      byId.delete(id);
    }
  }
  const rest = Array.from(byId.values()).sort(compareVendorNames);
  return [...result, ...rest];
}
