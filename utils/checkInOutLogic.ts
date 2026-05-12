/**
 * Pure punch / scan helpers (no InstantDB, no toasts). Used by `checkInOut.ts` and tests.
 */

export enum CheckActionType {
  CheckIn = "checkin",
  CheckOut = "checkout",
  SystemCheckOut = "sys_checkout",
  SystemCheckIn = "sys_checkin",
  AdminCheckIn = "admin_checkin",
  AdminCheckOut = "admin_checkout",
}

export const checkInTypes = new Set([
  CheckActionType.CheckIn,
  CheckActionType.SystemCheckIn,
  CheckActionType.AdminCheckIn,
]);

export const checkOutTypes = new Set([
  CheckActionType.CheckOut,
  CheckActionType.AdminCheckOut,
  CheckActionType.SystemCheckOut,
]);

export type PunchLike = {
  type: string;
  timestamp: number;
  serverCreatedAt?: number;
};

export function extractUserId(scannedId: string) {
  if (/[a-zA-Z]/.test(scannedId)) {
    return scannedId;
  }

  const patterns = [
    { prefix: "100", length: 9 },
    { prefix: "21", length: 8 },
    { prefix: "20", length: 8 },
    { prefix: "104", length: 9 },
    { prefix: "600", length: 9 },
  ];

  let bestMatch = { match: "", startIndex: Infinity, length: 0 };

  for (const pattern of patterns) {
    let startIndex = scannedId.indexOf(pattern.prefix);
    while (startIndex !== -1) {
      if (startIndex + pattern.length <= scannedId.length) {
        const possibleMatch = scannedId.substr(startIndex, pattern.length);

        if (
          startIndex < bestMatch.startIndex ||
          (startIndex === bestMatch.startIndex &&
            pattern.length > bestMatch.length)
        ) {
          bestMatch = {
            match: possibleMatch,
            startIndex: startIndex,
            length: pattern.length,
          };
        }
      }

      startIndex = scannedId.indexOf(pattern.prefix, startIndex + 1);
    }
  }

  if (bestMatch.match) {
    return bestMatch.match;
  }
  return scannedId;
}

export function getMostReliablePunch(
  punches: PunchLike[] | undefined | null
): PunchLike | null {
  if (!punches || punches.length === 0) return null;

  return [...punches].sort((a, b) => {
    if (a.serverCreatedAt && b.serverCreatedAt) {
      return b.serverCreatedAt - a.serverCreatedAt;
    }
    return b.timestamp - a.timestamp;
  })[0];
}

/**
 * Next kiosk punch when not forcing admin/system action.
 * If last punch was at least `resetHours` ago, always check in (new "day" / stale session).
 */
export function determineAutoPunchAction(
  lastPunch: PunchLike | null,
  nowMs: number,
  resetHours: number
): CheckActionType {
  if (!lastPunch) {
    return CheckActionType.CheckIn;
  }

  const lastPunchTime = new Date(lastPunch.timestamp).getTime();
  const hoursSinceLastPunch = (nowMs - lastPunchTime) / (1000 * 60 * 60);

  if (hoursSinceLastPunch >= resetHours) {
    return CheckActionType.CheckIn;
  }

  return checkOutTypes.has(lastPunch.type as CheckActionType)
    ? CheckActionType.CheckIn
    : CheckActionType.CheckOut;
}
