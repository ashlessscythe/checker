/** Matches `useAutoCheckout` when env is unset or invalid. */
export const DEFAULT_STALE_CHECKIN_HOURS = 16;

export function getStaleCheckinMaxDurationMs(): number {
  const parsed = parseInt(
    process.env.NEXT_PUBLIC_STALE_CHECKIN_CLEANUP_HOURS ?? "",
    10
  );
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed * 60 * 60 * 1000;
  }
  return DEFAULT_STALE_CHECKIN_HOURS * 60 * 60 * 1000;
}

export function getStaleCheckinHoursForDisplay(): number {
  const parsed = parseInt(
    process.env.NEXT_PUBLIC_STALE_CHECKIN_CLEANUP_HOURS ?? "",
    10
  );
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_STALE_CHECKIN_HOURS;
}
