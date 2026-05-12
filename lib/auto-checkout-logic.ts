import {
  checkInTypes,
  getMostReliablePunch,
  type PunchLike,
} from "@/utils/checkInOutLogic";

/**
 * True when the user's latest punch is a check-in and it is older than `maxCheckinDurationMs`
 * (same rule as `useAutoCheckout` for system checkout).
 */
export function userQualifiesForStaleAutoCheckout(
  punches: PunchLike[] | undefined,
  nowMs: number,
  maxCheckinDurationMs: number
): boolean {
  if (!punches?.length) return false;

  const lastPunch = getMostReliablePunch(punches);
  if (!lastPunch) return false;

  if (!checkInTypes.has(lastPunch.type as any)) return false;

  const timeSinceLastPunch =
    nowMs - new Date(lastPunch.timestamp).getTime();

  return timeSinceLastPunch > maxCheckinDurationMs;
}
