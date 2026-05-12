/**
 * Punch / check-in-out helpers. performCheckinOut only transacts `punches` on InstantDB.
 * No visitor pre-check, Resend, or /api/visitor/precheck/* — do not add those here.
 */
import { tx, id } from "@instantdb/react";
import { db } from "@/lib/instantdb";
import toast from "react-hot-toast";
import { getDeviceId } from "./deviceId";
import {
  CheckActionType,
  determineAutoPunchAction,
  getMostReliablePunch,
} from "./checkInOutLogic";

export {
  CheckActionType,
  checkInTypes,
  checkOutTypes,
  extractUserId,
  getMostReliablePunch,
} from "./checkInOutLogic";

const RESET_HOURS = parseInt(process.env.NEXT_PUBLIC_RESET_HOURS || "14", 10);

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

const checkInColors = {
  background: "#d1fae5",
  color: "#065f46",
  border: "2px solid #059669",
};

const checkOutColors = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "2px solid #dc2626",
};

const errorColors = {
  background: "#fef2f2",
  color: "#7f1d1d",
  border: "2px solid #b91c1c",
};

type ForceAction = CheckActionType | undefined;

export async function performCheckinOut(entity: any, force?: ForceAction) {
  if (!entity) {
    toast.error("User/Visitor not found");
    return;
  }

  console.log(`performing punch for user ${JSON.stringify(entity)}`);

  const isVisitor = entity.purpose !== undefined;

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
  } else {
    actionType = determineAutoPunchAction(
      lastPunch,
      Date.now(),
      RESET_HOURS
    );
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
          timestamp: currentTime,
          isSystemGenerated: isSystemAction,
          isAdminGenerated: isAdminAction,
          userId: entity.id,
          serverCreatedAt: currentTime,
          device: deviceId,
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
        );
        return attemptTransaction(retryCount + 1);
      }
      throw error;
    }
  };

  try {
    await attemptTransaction();

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
    throw error;
  }
}
