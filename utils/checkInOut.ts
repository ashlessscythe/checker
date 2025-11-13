import { tx, id } from "@instantdb/react";
import { db } from "@/lib/instantdb";
import toast, { Toaster } from "react-hot-toast";
import { getDeviceId } from "./deviceId";

// from .env 14 by default
const RESET_HOURS = parseInt(process.env.NEXT_PUBLIC_RESET_HOURS || "14", 10);

// Define base toast style
const baseToastStyle = {
  style: {
    padding: "16px",
    borderRadius: "10px",
    fontSize: "20px",
    maxWidth: "500px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  duration: 3000,
};

// Define color schemes with better contrast
const checkInColors = {
  background: "#d1fae5", // Very light green background
  color: "#065f46", // Dark green text
  border: "2px solid #059669", // Medium green border
};

const checkOutColors = {
  background: "#fee2e2", // Very light red background
  color: "#991b1b", // Dark red text
  border: "2px solid #dc2626", // Medium red border
};

const errorColors = {
  background: "#fef2f2", // Very light red background
  color: "#7f1d1d", // Dark red text
  border: "2px solid #b91c1c", // Medium red border
};

// Define an enum for all possible action types
export enum CheckActionType {
  CheckIn = "checkin",
  CheckOut = "checkout",
  SystemCheckOut = "sys_checkout",
  SystemCheckIn = "sys_checkin",
  AdminCheckIn = "admin_checkin",
  AdminCheckOut = "admin_checkout",
}

// Determine the action type
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

// Extract user ID from scanned barcode
export function extractUserId(scannedId: string) {
  // Check if the scannedId contains any alphabetic characters
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
  } else {
    return scannedId;
  }
}

// Define a type for the force parameter
type ForceAction = CheckActionType | undefined;

// Helper function to get the most reliable punch
export function getMostReliablePunch(punches) {
  if (!punches || punches.length === 0) return null;

  // Sort by serverCreatedAt (most reliable) then by timestamp as fallback
  return [...punches].sort((a, b) => {
    // First compare by serverCreatedAt (most reliable server timestamp)
    if (a.serverCreatedAt && b.serverCreatedAt) {
      return b.serverCreatedAt - a.serverCreatedAt;
    }
    // Fall back to client timestamp if serverCreatedAt is missing
    return b.timestamp - a.timestamp;
  })[0];
}

export async function performCheckinOut(entity: any, force?: ForceAction) {
  if (!entity) {
    toast.error("User/Visitor not found");
    return;
  }

  console.log(`performing punch for user ${JSON.stringify(entity)}`);

  // Check if entity is a visitor by checking if they're in the VISITOR department
  const isVisitor = entity.purpose !== undefined;

  // Get the most reliable last punch for this entity
  const lastPunch = getMostReliablePunch(entity.punches);
  console.log(`last punch is ${JSON.stringify(lastPunch)}`);

  let actionType: CheckActionType;
  let isSystemAction = false;
  let isAdminAction = false;

  if (force) {
    actionType = force;
    isSystemAction = [
      CheckActionType.SystemCheckOut,
      CheckActionType.SystemCheckIn,
    ].includes(force);
    isAdminAction =
      force === CheckActionType.AdminCheckIn ||
      force === CheckActionType.AdminCheckOut;
  } else if (!lastPunch) {
    // First punch ever is always check-in
    actionType = CheckActionType.CheckIn;
  } else {
    // Calculate hours since last punch
    const lastPunchTime = new Date(lastPunch.timestamp).getTime();
    const currentTime = Date.now();
    const hoursSinceLastPunch =
      (currentTime - lastPunchTime) / (1000 * 60 * 60);

    // If time since last punch is >= RESET_HOURS, always check in
    if (hoursSinceLastPunch >= RESET_HOURS) {
      actionType = CheckActionType.CheckIn;
    } else {
      // Always do the opposite of the last punch
      actionType = checkOutTypes.has(lastPunch.type)
        ? CheckActionType.CheckIn
        : CheckActionType.CheckOut;
    }
  }

  console.log(`Determined action: ${actionType}`);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  const attemptTransaction = async (retryCount = 0) => {
    try {
      const newPunchId = id();
      const currentTime = Date.now();
      const deviceId = getDeviceId();

      await db.transact([
        tx.punches[newPunchId].update({
          type: actionType,
          timestamp: currentTime, // Client timestamp
          isSystemGenerated: isSystemAction,
          isAdminGenerated: isAdminAction,
          userId: entity.id, // Add userId field
          serverCreatedAt: currentTime, // This will be overwritten by the server with its own timestamp
          device: deviceId, // Device identifier
        }),
      ]);
      return true;
    } catch (error) {
      if (
        retryCount < MAX_RETRIES &&
        (error.message?.includes("timed out") ||
          error.message?.includes("validation failed") ||
          error.message?.includes("network error"))
      ) {
        console.log(
          `Retry ${retryCount + 1}/${MAX_RETRIES} after error: ${error.message}`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY * (retryCount + 1))
        ); // Exponential backoff
        return attemptTransaction(retryCount + 1);
      }
      throw error;
    }
  };

  try {
    await attemptTransaction();

    // Handle notifications
    switch (actionType) {
      case CheckActionType.CheckIn:
      case CheckActionType.CheckOut:
        toast.success(
          `${isVisitor ? "Visitor" : ""} ${entity.name}: ${
            actionType === CheckActionType.CheckIn
              ? "checked in"
              : "checked out"
          }`,
          {
            ...baseToastStyle,
            style: {
              ...baseToastStyle.style,
              ...(actionType === CheckActionType.CheckIn
                ? checkInColors
                : checkOutColors),
              animation: "pop-up 0.5s ease-out",
            },
          }
        );
        break;
      case CheckActionType.AdminCheckIn:
      case CheckActionType.AdminCheckOut:
        toast.success(
          `Admin ${
            actionType === CheckActionType.AdminCheckIn
              ? "checked in"
              : "checked out"
          } ${isVisitor ? "visitor" : ""} ${entity.name}`,
          {
            ...baseToastStyle,
            style: {
              ...baseToastStyle.style,
              ...(actionType === CheckActionType.AdminCheckIn
                ? checkInColors
                : checkOutColors),
              animation: "pop-up 0.5s ease-out",
            },
          }
        );
        break;
      case CheckActionType.SystemCheckOut:
        console.log(
          `System checkout performed for ${isVisitor ? "visitor" : "user"} ${
            entity.name
          }`
        );
        break;
    }
  } catch (error) {
    if (!isSystemAction) {
      const errorMessage = error.message?.includes("timed out")
        ? "Operation timed out. Please try again."
        : "An error occurred. Please try again.";

      toast.error(errorMessage, {
        ...baseToastStyle,
        icon: "❌",
        style: {
          ...baseToastStyle.style,
          ...errorColors,
          animation: "shake 0.5s ease-in-out",
        },
      });
    }
    console.error("Check-in/out error:", error);
    throw error; // Re-throw to allow component level handling
  }
}
