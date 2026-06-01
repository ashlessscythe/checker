const STORAGE_KEY = "checker-kiosk-recent-vendor-ids";
const MAX_IDS = 12;

export function readRecentVendorIdsFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && !!id.trim());
  } catch {
    return [];
  }
}

export function recordRecentVendorIdInStorage(vendorId: string): string[] {
  const id = vendorId.trim();
  if (!id || typeof window === "undefined") return readRecentVendorIdsFromStorage();
  const prev = readRecentVendorIdsFromStorage().filter((x) => x !== id);
  const next = [id, ...prev].slice(0, MAX_IDS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  return next;
}

/** Local picks first, then server list; unique, capped. */
export function mergeRecentVendorIds(
  localIds: string[],
  serverIds: string[],
  limit = MAX_IDS
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...localIds, ...serverIds]) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}
